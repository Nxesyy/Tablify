import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateAdminDto } from './dto/update-admin.dto.js';
import { CreateMemberAdminDto } from './dto/create-member-admin.dto.js';
import { UpdateMemberAdminDto } from './dto/update-member-admin.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BcryptService } from '../bcrypt/bcrypt.service.js';
import { SpacesService } from '../spaces/spaces.service.js';
import { DiskonService } from '../diskon/diskon.service.js';
import { ReservasiService } from '../reservasi/reservasi.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptService: BcryptService,
    private readonly spacesService: SpacesService,
    private readonly diskonService: DiskonService,
    private readonly reservasiService: ReservasiService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. PROFIL LOKASI COWORKING SPACE (PANEL ADMIN)
  // ---------------------------------------------------------------------------
  async getProfile(userId: number) {
    const admin = await this.prisma.space_owner.findFirst({
      where: {
        OR: [{ id_user: userId }, { id: userId }],
      },
      select: {
        id: true,
        id_user: true,
        nama_coworking: true,
        nama_pemilik: true,
        telp: true,
        alamat: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Data admin/lokasi coworking tidak ditemukan');
    }

    return {
      status: true,
      statusCode: 200,
      message: 'Berhasil memproses permintaan',
      success: true,
      data: admin,
      timestamp: new Date().toISOString(),
    };
  }

  async updateProfile(userId: number, updateDto: UpdateAdminDto) {
    const admin = await this.prisma.space_owner.findFirst({
      where: {
        OR: [{ id_user: userId }, { id: userId }],
      },
    });

    if (!admin) {
      throw new NotFoundException('Data admin tidak ditemukan');
    }

    const updateData: any = {};
    if (updateDto.nama_coworking) updateData.nama_coworking = updateDto.nama_coworking;
    if (updateDto.nama_pemilik) updateData.nama_pemilik = updateDto.nama_pemilik;
    if (updateDto.telp) updateData.telp = updateDto.telp;
    if (updateDto.alamat !== undefined) updateData.alamat = updateDto.alamat;

    const updated = await this.prisma.space_owner.update({
      where: { id: admin.id },
      data: updateData,
      include: {
        user: {
          select: {
            username: true,
            role: true,
          },
        },
      },
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Profil Coworking Space berhasil diperbarui!',
      success: true,
      data: {
        id: updated.id,
        nama_coworking: updated.nama_coworking,
        nama_pemilik: updated.nama_pemilik,
        telp: updated.telp,
        alamat: updated.alamat,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // 2. MANAJEMEN MEMBER / PELANGGAN (PANEL ADMIN)
  // ---------------------------------------------------------------------------
  async findAllMembers(userId: number, search?: string) {
    const id_owner = await this.getOwnerId(userId);

    // Filter HANYA member yang pernah mereservasi ke gerai milik admin ini (id_owner)
    const filter: any = {
      Reservasi: {
        some: {
          id_owner,
        },
      },
    };

    if (search && search.trim()) {
      const q = search.trim();
      filter.AND = [
        {
          OR: [
            { nama_member: { contains: q, mode: 'insensitive' } },
            { Instansi: { contains: q, mode: 'insensitive' } },
            { telp: { contains: q, mode: 'insensitive' } },
            { user: { username: { contains: q, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const allMembers = await this.prisma.member.findMany({
      where: filter,
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    // Ambil histori reservasi gerai ini untuk menghitung riwayat kunjungan & kontribusi belanja
    const ownerReservations = await this.prisma.reservasi.findMany({
      where: { id_owner },
      include: {
        detailReservasi: {
          include: { space: { select: { nama_space: true } } },
        },
      },
      orderBy: { tanggal_reservasi: 'desc' },
    });

    const memberStatsMap = new Map<number, any>();
    for (const res of ownerReservations) {
      if (!memberStatsMap.has(res.id_member)) {
        memberStatsMap.set(res.id_member, {
          total_reservasi: 0,
          total_pengeluaran: 0,
          kunjungan_terakhir: res.tanggal_reservasi,
          status_terakhir: res.status,
          meja_terakhir: res.detailReservasi?.space?.nama_space || '-',
        });
      }
      const stat = memberStatsMap.get(res.id_member);
      stat.total_reservasi += 1;
      if (res.status !== 'dibatalkan' && res.detailReservasi) {
        stat.total_pengeluaran += res.detailReservasi.total_harga || 0;
      }
    }

    const formattedMembers = allMembers.map((m) => {
      const stats = memberStatsMap.get(m.id) || {
        total_reservasi: 0,
        total_pengeluaran: 0,
        kunjungan_terakhir: m.createdAt,
        status_terakhir: '-',
        meja_terakhir: '-',
      };

      return {
        id: m.id,
        id_user: m.id_user,
        nama_member: m.nama_member,
        instansi: m.Instansi,
        Instansi: m.Instansi,
        alamat: m.alamat,
        telp: m.telp,
        foto: m.foto,
        username: m.user?.username || '-',
        email: m.user?.username || '-',
        created_at: m.createdAt,
        ...stats,
      };
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Berhasil memproses permintaan',
      success: true,
      data: formattedMembers,
      timestamp: new Date().toISOString(),
    };
  }

  // Alias untuk kompatibilitas frontend sebelumnya
  async findAll(userId: number) {
    return this.findAllMembers(userId);
  }

  async createMember(createDto: CreateMemberAdminDto) {
    // Cek duplikasi username
    const existingUser = await this.prisma.user.findUnique({
      where: { username: createDto.username },
    });
    if (existingUser) {
      throw new BadRequestException('Username sudah digunakan oleh akun lain!');
    }

    const hashedPassword = await this.bcryptService.hashPassword(createDto.password);

    // Buat User & Member dalam transaksi
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: createDto.username,
          password: hashedPassword,
          role: 'MEMBER',
        },
      });

      const member = await tx.member.create({
        data: {
          id_user: user.id,
          nama_member: createDto.nama_member,
          Instansi: createDto.instansi,
          alamat: createDto.alamat,
          telp: createDto.telp,
          foto: createDto.foto || null,
        },
      });

      return member;
    });

    return {
      status: true,
      statusCode: 201,
      message: 'Data member baru berhasil ditambahkan!',
      data: {
        id: result.id,
        nama_member: result.nama_member,
        instansi: result.Instansi,
        alamat: result.alamat,
        telp: result.telp,
        foto: result.foto,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async findMemberById(id: number) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
      },
    });

    if (!member) {
      throw new NotFoundException('Data member tidak ditemukan');
    }

    return {
      status: true,
      statusCode: 200,
      message: 'Berhasil memproses permintaan',
      data: {
        id: member.id,
        nama_member: member.nama_member,
        instansi: member.Instansi,
        alamat: member.alamat,
        telp: member.telp,
        foto: member.foto,
        username: member.user?.username,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async updateMember(id: number, updateDto: UpdateMemberAdminDto) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Data member tidak ditemukan');
    }

    // Jika password diperbarui
    if (updateDto.password) {
      const hashedPassword = await this.bcryptService.hashPassword(updateDto.password);
      await this.prisma.user.update({
        where: { id: member.id_user },
        data: { password: hashedPassword },
      });
    }

    const memberUpdate: any = {};
    if (updateDto.nama_member) memberUpdate.nama_member = updateDto.nama_member;
    if (updateDto.instansi) memberUpdate.Instansi = updateDto.instansi;
    if (updateDto.alamat !== undefined) memberUpdate.alamat = updateDto.alamat;
    if (updateDto.telp) memberUpdate.telp = updateDto.telp;
    if (updateDto.foto !== undefined) memberUpdate.foto = updateDto.foto;

    const updated = await this.prisma.member.update({
      where: { id },
      data: memberUpdate,
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Data member berhasil diperbarui!',
      data: {
        id: updated.id,
        nama_member: updated.nama_member,
        instansi: updated.Instansi,
        alamat: updated.alamat,
        telp: updated.telp,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async deleteMember(id: number) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Data member tidak ditemukan');
    }

    await this.prisma.$transaction(async (tx) => {
      // Hapus data detail dan reservasi terkait member jika ada
      await tx.detail_reservasi.deleteMany({ where: { id_member: id } });
      await tx.reservasi.deleteMany({ where: { id_member: id } });
      await tx.review.deleteMany({ where: { id_member: id } });
      await tx.member.delete({ where: { id } });
      await tx.user.delete({ where: { id: member.id_user } });
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Data member berhasil dihapus!',
      data: {
        id,
        deleted: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. MANAJEMEN SPACE (PANEL ADMIN)
  // ---------------------------------------------------------------------------
  async findAllSpaces(userId: number) {
    return this.spacesService.findMySpaces(userId);
  }

  async createSpace(createSpaceDto: any, userId: number) {
    return this.spacesService.create(createSpaceDto, userId);
  }

  async findSpaceById(id: number) {
    return this.spacesService.findOne(id);
  }

  async updateSpace(id: number, updateSpaceDto: any, userId: number) {
    return this.spacesService.update(id, updateSpaceDto, userId);
  }

  async deleteSpace(id: number, userId: number) {
    return this.spacesService.remove(id, userId);
  }

  // ---------------------------------------------------------------------------
  // 4. MANAJEMEN KODE PROMO & DISKON (PANEL ADMIN)
  // ---------------------------------------------------------------------------
  async findAllDiskon(userId: number) {
    return this.diskonService.findAll(userId);
  }

  async createDiskon(createDiskonDto: any, userId: number) {
    return this.diskonService.create(createDiskonDto, userId);
  }

  async findDiskonById(id: number, userId: number) {
    return this.diskonService.findOne(id, userId);
  }

  async updateDiskon(id: number, updateDiskonDto: any, userId: number) {
    return this.diskonService.update(id, updateDiskonDto, userId);
  }

  async deleteDiskon(id: number, userId: number) {
    return this.diskonService.remove(id, userId);
  }

  // ---------------------------------------------------------------------------
  // 5. TRANSAKSI RESERVASI & CHECK-IN/CHECK-OUT (PANEL ADMIN)
  // ---------------------------------------------------------------------------
  async findAllReservations(
    userId: number,
    query?: {
      month?: number;
      year?: number;
      status?: string;
      id_space?: number;
      tanggal?: string;
    },
  ) {
    const id_owner = await this.getOwnerId(userId);
    const whereClause: any = { id_owner };

    // Filter status (mendukung format enum database maupun lowercase PDF)
    if (query?.status) {
      const s = query.status.toLowerCase();
      if (s === 'belum_dikonfirm' || s === 'belum_dikonfirmasi') {
        whereClause.status = 'Belum_Dikonfirmasi';
      } else if (s === 'disetujui') {
        whereClause.status = 'Disetujui';
      } else if (s === 'aktif') {
        whereClause.status = 'aktif';
      } else if (s === 'selesai') {
        whereClause.status = 'selesai';
      } else if (s === 'dibatalkan') {
        whereClause.status = 'dibatalkan';
      } else {
        whereClause.status = query.status;
      }
    }

    // Filter space
    if (query?.id_space) {
      whereClause.detailReservasi = { id_space: Number(query.id_space) };
    }

    // Filter tanggal spesifik
    if (query?.tanggal) {
      const targetDate = new Date(query.tanggal);
      const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0));
      const endOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999));
      whereClause.tanggal_reservasi = { gte: startOfDay, lte: endOfDay };
    } else if (query?.month && query?.year) {
      const year = Number(query.year);
      const month = Number(query.month);
      whereClause.tanggal_reservasi = {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
      };
    } else if (query?.year) {
      const year = Number(query.year);
      whereClause.tanggal_reservasi = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      };
    }

    const list = await this.prisma.reservasi.findMany({
      where: whereClause,
      include: {
        member: {
          select: {
            id: true,
            nama_member: true,
            Instansi: true,
            telp: true,
          },
        },
        detailReservasi: {
          include: {
            space: {
              select: {
                id: true,
                nama_space: true,
                tipe: true,
                harga_per_jam: true,
              },
            },
            diskon: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    const formatted = list.map((res) => {
      let mappedStatus: string = res.status;
      if (res.status === 'Belum_Dikonfirmasi') mappedStatus = 'belum_dikonfirm';
      else if (res.status === 'Disetujui') mappedStatus = 'disetujui';

      const spaceTypeStr = res.detailReservasi?.space?.tipe
        ? res.detailReservasi.space.tipe.toLowerCase()
        : 'desk';

      const totalHargaAwal = res.detailReservasi?.subtotal ?? res.detailReservasi?.total_harga ?? 0;
      const potongan = res.detailReservasi?.potongan ?? 0;
      const totalBayar = res.detailReservasi?.total_harga ?? 0;

      const jamMulaiStr = res.jam_mulai instanceof Date
        ? res.jam_mulai.toTimeString().slice(0, 5)
        : String(res.jam_mulai).slice(0, 5);
      const jamSelesaiStr = res.jam_selesai instanceof Date
        ? res.jam_selesai.toTimeString().slice(0, 5)
        : res.jam_selesai ? String(res.jam_selesai).slice(0, 5) : '-';

      return {
        id: res.id,
        kode_booking: res.kode_tiket || `BOOK-${res.id}`,
        tanggal_reservasi: new Date(res.tanggal_reservasi).toISOString().slice(0, 10),
        jam_mulai: jamMulaiStr,
        jam_selesai: jamSelesaiStr,
        durasi_jam: res.durasi_jam,
        total_harga_awal: totalHargaAwal,
        potongan_diskon: potongan,
        total_bayar: totalBayar,
        status: mappedStatus,
        member: {
          id: res.member?.id,
          nama_member: res.member?.nama_member,
          telp: res.member?.telp,
        },
        space: {
          id: res.detailReservasi?.space?.id,
          nama_space: res.detailReservasi?.space?.nama_space,
          tipe: spaceTypeStr,
        },
      };
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Berhasil memproses permintaan',
      data: formatted,
      timestamp: new Date().toISOString(),
    };
  }

  async updateReservationStatus(id: number, status: string, userId: number) {
    const id_owner = await this.getOwnerId(userId);
    const reservasi = await this.prisma.reservasi.findUnique({ where: { id } });

    if (!reservasi) {
      throw new NotFoundException('Data reservasi tidak ditemukan');
    }
    if (reservasi.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak berhak mengubah status reservasi gerai lain');
    }

    let prismaStatus: any = status;
    if (status.toLowerCase() === 'belum_dikonfirm' || status.toLowerCase() === 'belum_dikonfirmasi') {
      prismaStatus = 'Belum_Dikonfirmasi';
    } else if (status.toLowerCase() === 'disetujui') {
      prismaStatus = 'Disetujui';
    } else if (status.toLowerCase() === 'aktif') {
      prismaStatus = 'aktif';
    } else if (status.toLowerCase() === 'selesai') {
      prismaStatus = 'selesai';
    } else if (status.toLowerCase() === 'dibatalkan') {
      prismaStatus = 'dibatalkan';
    }

    const updated = await this.prisma.reservasi.update({
      where: { id },
      data: { status: prismaStatus },
    });

    return {
      status: true,
      statusCode: 200,
      message: `Status reservasi berhasil diperbarui menjadi ${status}`,
      data: {
        id: updated.id,
        status: status,
        updated_at: updated.updatedAt,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async checkInReservation(id: number, userId: number) {
    const id_owner = await this.getOwnerId(userId);
    const reservasi = await this.prisma.reservasi.findUnique({ where: { id } });

    if (!reservasi) {
      throw new NotFoundException('Data reservasi tidak ditemukan');
    }
    if (reservasi.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak berhak melakukan check-in reservasi gerai lain');
    }

    const updated = await this.prisma.reservasi.update({
      where: { id },
      data: { status: 'aktif' },
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Check-in member berhasil! Status reservasi aktif.',
      data: {
        id: updated.id,
        status: 'aktif',
        check_in_time: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async checkOutReservation(id: number, userId: number) {
    const id_owner = await this.getOwnerId(userId);
    const reservasi = await this.prisma.reservasi.findUnique({ where: { id } });

    if (!reservasi) {
      throw new NotFoundException('Data reservasi tidak ditemukan');
    }
    if (reservasi.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak berhak melakukan check-out reservasi gerai lain');
    }

    const updated = await this.prisma.reservasi.update({
      where: { id },
      data: { status: 'selesai' },
    });

    return {
      status: true,
      statusCode: 200,
      message: 'Check-out member berhasil! Reservasi telah selesai.',
      data: {
        id: updated.id,
        status: 'selesai',
        check_out_time: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // 6. REKAPITULASI LAPORAN PENDAPATAN BULANAN (PANEL ADMIN)
  // ---------------------------------------------------------------------------
  async getMonthlyReport(userId: number, month?: number, year?: number) {
    const id_owner = await this.getOwnerId(userId);
    const now = new Date();
    const targetYear = year ? Number(year) : now.getFullYear();
    const targetMonth = month ? Number(month) : now.getMonth() + 1;

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const reservations = await this.prisma.reservasi.findMany({
      where: {
        id_owner,
        tanggal_reservasi: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        detailReservasi: {
          include: { space: true },
        },
      },
    });

    let totalTransaksi = reservations.length;
    let totalJamTerpakai = 0;
    let estimasiPendapatanKotor = 0;
    let totalPotonganDiskon = 0;
    let realisasiPendapatanBersih = 0;

    const typeStats: Record<string, { total_booking: number; total_jam: number; total_pendapatan: number }> = {
      desk: { total_booking: 0, total_jam: 0, total_pendapatan: 0 },
      meeting_room: { total_booking: 0, total_jam: 0, total_pendapatan: 0 },
      private_office: { total_booking: 0, total_jam: 0, total_pendapatan: 0 },
    };

    for (const res of reservations) {
      if (res.status !== 'dibatalkan' && res.detailReservasi) {
        totalJamTerpakai += res.durasi_jam;
        const subtotal = res.detailReservasi.subtotal ?? res.detailReservasi.total_harga ?? 0;
        const potongan = res.detailReservasi.potongan ?? 0;
        const total = res.detailReservasi.total_harga ?? 0;

        estimasiPendapatanKotor += subtotal;
        totalPotonganDiskon += potongan;
        realisasiPendapatanBersih += total;

        const rawType = res.detailReservasi.space?.tipe;
        let typeKey = 'desk';
        if (rawType === 'MEETING_ROOM') typeKey = 'meeting_room';
        else if (rawType === 'PRIVATE_OFFICE') typeKey = 'private_office';

        typeStats[typeKey].total_booking += 1;
        typeStats[typeKey].total_jam += res.durasi_jam;
        typeStats[typeKey].total_pendapatan += total;
      }
    }

    const rincianPerTipeSpace = [
      {
        tipe: 'desk',
        label: 'Personal Desk',
        total_booking: typeStats.desk.total_booking,
        total_jam: typeStats.desk.total_jam,
        total_pendapatan: typeStats.desk.total_pendapatan,
      },
      {
        tipe: 'meeting_room',
        label: 'Meeting Room',
        total_booking: typeStats.meeting_room.total_booking,
        total_jam: typeStats.meeting_room.total_jam,
        total_pendapatan: typeStats.meeting_room.total_pendapatan,
      },
      {
        tipe: 'private_office',
        label: 'Private Office',
        total_booking: typeStats.private_office.total_booking,
        total_jam: typeStats.private_office.total_jam,
        total_pendapatan: typeStats.private_office.total_pendapatan,
      },
    ];

    return {
      status: true,
      statusCode: 200,
      message: 'Berhasil memproses permintaan',
      data: {
        month: targetMonth,
        year: targetYear,
        total_transaksi: totalTransaksi,
        total_jam_terpakai: totalJamTerpakai,
        estimasi_pendapatan_kotor: estimasiPendapatanKotor,
        total_potongan_diskon: totalPotonganDiskon,
        realisasi_pendapatan_bersih: realisasiPendapatanBersih,
        rincian_per_tipe_space: rincianPerTipeSpace,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getIncomeReport(userId: number, month?: number, year?: number) {
    const monthly = await this.getMonthlyReport(userId, month, year);
    return {
      status: true,
      statusCode: 200,
      message: 'Berhasil memproses permintaan',
      data: {
        month: monthly.data.month,
        year: monthly.data.year,
        realisasi_pendapatan_bersih: monthly.data.realisasi_pendapatan_bersih,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // 7. HELPER & LEGACY ANALYTICS
  // ---------------------------------------------------------------------------
  private async getOwnerId(userId: number): Promise<number> {
    const owner = await this.prisma.space_owner.findFirst({
      where: {
        OR: [{ id_user: userId }, { id: userId }],
      },
    });
    if (!owner) {
      throw new NotFoundException('Data admin gerai tidak ditemukan');
    }
    return owner.id;
  }

  async getFinancialReport(
    userId: number,
    query?: { bulan?: number; tahun?: number; rentang?: string },
  ) {
    const id_owner = await this.getOwnerId(userId);
    const whereClause: any = { id_owner };

    const now = new Date();
    const rentang = query?.rentang || 'bulan';
    let startDate: Date;
    let endDate: Date = now;

    if (rentang === 'kemarin') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0));
      endDate = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999));
    } else if (rentang === 'seminggu') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (rentang === 'tahun') {
      const year = query?.tahun ? Number(query.tahun) : now.getFullYear();
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    } else {
      const year = query?.tahun ? Number(query.tahun) : now.getFullYear();
      const month = query?.bulan ? Number(query.bulan) : now.getMonth() + 1;
      startDate = new Date(Date.UTC(year, month - 1, 1));
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    }

    whereClause.tanggal_reservasi = {
      gte: startDate,
      lte: endDate,
    };

    const reservations = await this.prisma.reservasi.findMany({
      where: whereClause,
      include: {
        member: true,
        detailReservasi: {
          include: {
            space: true,
            diskon: true,
          },
        },
      },
      orderBy: { tanggal_reservasi: 'asc' },
    });

    let totalTransaksi = reservations.length;
    let transaksiSukses = 0;
    let omzetKotor = 0;
    let totalPotonganDiskon = 0;
    let pendapatanBersih = 0;
    let totalJamTerpakai = 0;

    const breakdownStatus: Record<string, number> = {
      Belum_Dikonfirmasi: 0,
      Disetujui: 0,
      aktif: 0,
      selesai: 0,
      dibatalkan: 0,
    };

    const chartMap = new Map<string, { label: string; revenue: number; transaksi: number; jam: number }>();

    if (rentang === 'kemarin') {
      const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
      for (const slot of timeSlots) {
        chartMap.set(slot, { label: slot, revenue: 0, transaksi: 0, jam: 0 });
      }
    } else if (rentang === 'seminggu') {
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        const label = days[d.getDay()];
        chartMap.set(key, { label, revenue: 0, transaksi: 0, jam: 0 });
      }
    } else if (rentang === 'tahun') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      for (let m = 0; m < 12; m++) {
        const key = `${startDate.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
        chartMap.set(key, { label: months[m], revenue: 0, transaksi: 0, jam: 0 });
      }
    } else {
      for (let i = 4; i >= 1; i--) {
        const label = `Minggu ke-${5 - i}`;
        chartMap.set(`W${5 - i}`, { label, revenue: 0, transaksi: 0, jam: 0 });
      }
    }

    for (const res of reservations) {
      breakdownStatus[res.status] = (breakdownStatus[res.status] || 0) + 1;

      if (res.status !== 'dibatalkan' && res.detailReservasi) {
        transaksiSukses += 1;
        totalJamTerpakai += res.durasi_jam;
        const subtotal = res.detailReservasi.subtotal ?? res.detailReservasi.total_harga ?? 0;
        const potongan = res.detailReservasi.potongan ?? 0;
        const total = res.detailReservasi.total_harga ?? 0;

        omzetKotor += subtotal;
        totalPotonganDiskon += potongan;
        pendapatanBersih += total;

        const resDate = new Date(res.tanggal_reservasi);
        if (rentang === 'kemarin') {
          const resHour = new Date(res.jam_mulai).getHours();
          const targetSlot = resHour < 10 ? '08:00' : resHour < 12 ? '10:00' : resHour < 14 ? '12:00' : resHour < 16 ? '14:00' : resHour < 18 ? '16:00' : resHour < 20 ? '18:00' : resHour < 22 ? '20:00' : '22:00';
          const slot = chartMap.get(targetSlot);
          if (slot) {
            slot.revenue += total;
            slot.transaksi += 1;
            slot.jam += res.durasi_jam;
          }
        } else if (rentang === 'seminggu') {
          const key = resDate.toISOString().slice(0, 10);
          const slot = chartMap.get(key);
          if (slot) {
            slot.revenue += total;
            slot.transaksi += 1;
            slot.jam += res.durasi_jam;
          }
        } else if (rentang === 'tahun') {
          const key = `${resDate.getFullYear()}-${String(resDate.getMonth() + 1).padStart(2, '0')}`;
          const slot = chartMap.get(key);
          if (slot) {
            slot.revenue += total;
            slot.transaksi += 1;
            slot.jam += res.durasi_jam;
          }
        } else {
          const diffDays = Math.max(0, Math.floor((endDate.getTime() - resDate.getTime()) / (1000 * 60 * 60 * 24)));
          const weekIndex = Math.min(4, Math.max(1, 4 - Math.floor(diffDays / 7)));
          const slot = chartMap.get(`W${weekIndex}`);
          if (slot) {
            slot.revenue += total;
            slot.transaksi += 1;
            slot.jam += res.durasi_jam;
          }
        }
      }
    }

    const chartData = Array.from(chartMap.values());

    const rentangLabelMap: Record<string, string> = {
      kemarin: 'Kemarin',
      seminggu: 'Seminggu Kemarin',
      bulan: 'Bulan Kemarin',
      tahun: 'Setahun Kemarin',
    };

    const riwayatTransaksi = reservations
      .slice()
      .reverse()
      .slice(0, 15)
      .map((r) => ({
        id: r.id,
        kode_tiket: r.kode_tiket,
        nama_member: r.member?.nama_member || 'Pelanggan',
        foto_member: r.member?.foto,
        nama_space: r.detailReservasi?.space?.nama_space || 'Meja Gerai',
        jam_mulai: r.jam_mulai.toISOString(),
        jam_selesai: r.jam_selesai ? r.jam_selesai.toISOString() : null,
        durasi_jam: r.durasi_jam,
        total_harga: r.detailReservasi?.total_harga || 0,
        potongan: r.detailReservasi?.potongan || 0,
        persentase_diskon: r.detailReservasi?.diskon?.presentase_diskon || null,
        status: r.status,
      }));

    return {
      success: true,
      periode: {
        rentang,
        label: rentangLabelMap[rentang] || 'Periode',
        mulai: startDate.toISOString().slice(0, 10),
        sampai: endDate.toISOString().slice(0, 10),
      },
      ringkasan: {
        total_transaksi: totalTransaksi,
        transaksi_sukses: transaksiSukses,
        total_jam_terpakai: totalJamTerpakai,
        omzet_kotor: omzetKotor,
        total_potongan_diskon: totalPotonganDiskon,
        pendapatan_bersih: pendapatanBersih,
      },
      status_breakdown: breakdownStatus,
      chart_data: chartData,
      riwayat_transaksi: riwayatTransaksi,
      data: {
        summary: {
          total_transaksi: totalTransaksi,
          transaksi_sukses: transaksiSukses,
          total_jam_terpakai: totalJamTerpakai,
          omzet_kotor: omzetKotor,
          total_diskon: totalPotonganDiskon,
          pendapatan_bersih: pendapatanBersih,
        },
        breakdown_status: breakdownStatus,
        chart: chartData,
      },
    };
  }

  async getOccupancyAnalytics(userId: number, query?: { bulan?: number; tahun?: number }) {
    const id_owner = await this.getOwnerId(userId);
    const whereClause: any = {
      id_owner,
      status: { not: 'dibatalkan' },
    };

    if (query?.tahun) {
      const year = Number(query.tahun);
      if (query?.bulan) {
        const month = Number(query.bulan);
        whereClause.tanggal_reservasi = {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        };
      } else {
        whereClause.tanggal_reservasi = {
          gte: new Date(Date.UTC(year, 0, 1)),
          lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
        };
      }
    }

    const reservations = await this.prisma.reservasi.findMany({
      where: whereClause,
      include: {
        detailReservasi: {
          include: { space: true },
        },
      },
    });

    const spaceUsageMap: Record<number, { id: number; nama_space: string; tipe: string; total_booking: number; total_jam: number }> = {};
    const hourlyDistribution: Record<string, number> = {};
    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      hourlyDistribution[label] = 0;
    }

    for (const res of reservations) {
      if (res.detailReservasi?.space) {
        const sp = res.detailReservasi.space;
        if (!spaceUsageMap[sp.id]) {
          spaceUsageMap[sp.id] = {
            id: sp.id,
            nama_space: sp.nama_space,
            tipe: sp.tipe,
            total_booking: 0,
            total_jam: 0,
          };
        }
        spaceUsageMap[sp.id].total_booking += 1;
        spaceUsageMap[sp.id].total_jam += res.durasi_jam;
      }

      const hour = new Date(res.jam_mulai).getHours();
      const hourLabel = `${String(hour).padStart(2, '0')}:00`;
      hourlyDistribution[hourLabel] = (hourlyDistribution[hourLabel] || 0) + 1;
    }

    const ruanganTerpopuler = Object.values(spaceUsageMap).sort(
      (a, b) => b.total_booking - a.total_booking,
    );

    let peakHour = '00:00';
    let maxBookingsInHour = 0;
    for (const [hour, count] of Object.entries(hourlyDistribution)) {
      if (count > maxBookingsInHour) {
        maxBookingsInHour = count;
        peakHour = hour;
      }
    }

    return {
      success: true,
      total_reservasi_dianalisis: reservations.length,
      ruangan_terpopuler: ruanganTerpopuler,
      jam_tersibuk: {
        peak_hour: peakHour,
        frekuensi_booking: maxBookingsInHour,
        distribusi_per_jam: hourlyDistribution,
      },
    };
  }
}
