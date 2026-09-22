import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { UpdateSpaceDto } from './dto/update-space.dto.js';
import { CheckAvailabilityDto } from './dto/check-availability.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EventsService } from '../events/events.service.js';

@Injectable()
export class SpacesService {
  private catalogCache = new Map<string, { data: any; expiry: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Mendapatkan id_owner dari userId akun admin
   */
  private async getOwnerIdByUserId(userId: number): Promise<number> {
    const owner = await this.prisma.space_owner.findUnique({
      where: { id_user: userId },
    });
    if (!owner) {
      throw new ForbiddenException(
        'Hanya pengelola space/admin kafe yang berwenang melakukan tindakan ini',
      );
    }
    return owner.id;
  }

  /**
   * Helper parsing waktu mulai dan waktu selesai
   */
  public parseStartAndEnd(
    tanggal: string,
    jamMulai: string,
    durasiJam: number,
  ): { start: Date; end: Date } {
    let start: Date;

    // Jika jamMulai adalah ISO String lengkap
    if (jamMulai.includes('T')) {
      start = new Date(jamMulai);
    } else {
      // Format YYYY-MM-DD dan HH:mm
      const [hours, minutes] = jamMulai.split(':').map(Number);
      const cleanDate = tanggal.split('T')[0];
      start = new Date(`${cleanDate}T${String(hours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}:00`);
    }

    if (isNaN(start.getTime())) {
      throw new BadRequestException('Format tanggal atau jam mulai tidak valid');
    }

    const end = new Date(start.getTime() + durasiJam * 60 * 60 * 1000);
    return { start, end };
  }

  /**
   * Tambah katalog meja/ruang baru (Admin Space Owner)
   */
  async create(createSpaceDto: CreateSpaceDto, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);

    const space = await this.prisma.space.create({
      data: {
        nama_space: createSpaceDto.nama_space,
        harga_per_jam: Number(createSpaceDto.harga_per_jam),
        tipe: createSpaceDto.tipe as any,
        kapasitas: Number(createSpaceDto.kapasitas),
        foto: createSpaceDto.foto || null,
        deskripsi: createSpaceDto.deskripsi,
        id_owner,
      },
      include: {
        owner: {
          select: {
            id: true,
            nama_coworking: true,
            nama_pemilik: true,
            telp: true,
          },
        },
      },
    });

    this.eventsService.emit('SPACE_UPDATED', {
      action: 'CREATED',
      space,
      id_owner,
    });

    return {
      success: true,
      message: 'Meja/ruangan berhasil ditambahkan ke katalog',
      data: space,
    };
  }

  /**
   * Ambil katalog seluruh space (bisa difilter oleh publik/member)
   */
  async findAll(query?: {
    id_owner?: number;
    tipe?: string;
    kapasitas_min?: number;
    search?: string;
  }) {
    const cacheKey = JSON.stringify(query || {});
    const cached = this.catalogCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const whereClause: any = {};

    if (query?.id_owner) {
      whereClause.id_owner = Number(query.id_owner);
    }
    if (query?.tipe) {
      whereClause.tipe = query.tipe;
    }
    if (query?.kapasitas_min) {
      whereClause.kapasitas = { gte: Number(query.kapasitas_min) };
    }
    if (query?.search) {
      whereClause.OR = [
        { nama_space: { contains: query.search, mode: 'insensitive' } },
        { deskripsi: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let spaces: any[] = [];
    let todayReservations: any[] = [];

    if (query?.id_owner) {
      [spaces, todayReservations] = await Promise.all([
        this.prisma.space.findMany({
          where: whereClause,
          include: {
            owner: {
              select: {
                id: true,
                nama_coworking: true,
                nama_pemilik: true,
                telp: true,
                alamat: true,
              },
            },
          },
          orderBy: { id: 'desc' },
        }),
        this.prisma.reservasi.findMany({
          where: {
            id_owner: Number(query.id_owner),
            status: { not: 'dibatalkan' },
            tanggal_reservasi: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            id: true,
            kode_tiket: true,
            status: true,
            jam_mulai: true,
            jam_selesai: true,
            durasi_jam: true,
            detailReservasi: {
              select: { id_space: true },
            },
          },
          orderBy: { jam_mulai: 'asc' },
        }),
      ]);
    } else {
      spaces = await this.prisma.space.findMany({
        where: whereClause,
        include: {
          owner: {
            select: {
              id: true,
              nama_coworking: true,
              nama_pemilik: true,
              telp: true,
              alamat: true,
            },
          },
        },
        orderBy: { id: 'desc' },
      });

      const spaceIds = spaces.map((s) => s.id);
      if (spaceIds.length === 0) {
        return {
          success: true,
          total: 0,
          data: [],
        };
      }

      todayReservations = await this.prisma.reservasi.findMany({
        where: {
          detailReservasi: {
            id_space: { in: spaceIds },
          },
          status: { not: 'dibatalkan' },
          tanggal_reservasi: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        select: {
          id: true,
          kode_tiket: true,
          status: true,
          jam_mulai: true,
          jam_selesai: true,
          durasi_jam: true,
          detailReservasi: {
            select: { id_space: true },
          },
        },
        orderBy: { jam_mulai: 'asc' },
      });
    }

    const spacesWithStatus = spaces.map((space) => {
      const spaceReservations = todayReservations.filter(
        (r) => r.detailReservasi?.id_space === space.id,
      );

      const activeRes = spaceReservations.find((r) => r.status === 'aktif');
      const pendingRes = spaceReservations.find((r) => r.status === 'Belum_Dikonfirmasi');
      const reservedRes = spaceReservations.find((r) => r.status === 'Disetujui');

      let live_status: 'AVAILABLE' | 'IN_USE' | 'RESERVED' | 'PENDING' = 'AVAILABLE';
      let status_label = 'Tersedia';

      if (activeRes) {
        live_status = 'IN_USE';
        status_label = 'Sedang Digunakan';
      } else if (pendingRes) {
        live_status = 'PENDING';
        status_label = 'Reserved / Pending (Bayar di Kasir)';
      } else if (reservedRes) {
        live_status = 'RESERVED';
        status_label = 'Reserved';
      }

      return {
        ...space,
        live_status,
        status_label,
        active_session: activeRes || pendingRes || reservedRes || null,
      };
    });

    const responsePayload = {
      success: true,
      total: spacesWithStatus.length,
      data: spacesWithStatus,
    };

    this.catalogCache.set(cacheKey, {
      data: responsePayload,
      expiry: Date.now() + 15000,
    });

    return responsePayload;
  }

  /**
   * Mengambil daftar seluruh kafe / gerai mitra aktif
   */
  async findAllCafes() {
    const cafes = await this.prisma.space_owner.findMany({
      select: {
        id: true,
        nama_coworking: true,
        nama_pemilik: true,
        telp: true,
        alamat: true,
        _count: {
          select: { space: true },
        },
      },
      orderBy: { nama_coworking: 'asc' },
    });

    return {
      success: true,
      total: cafes.length,
      data: cafes.map((c) => ({
        ...c,
        jumlah_meja: c._count?.space ?? 0,
      })),
    };
  }

  /**
   * Khusus Admin: Menampilkan seluruh meja milik gerai admin yang sedang login
   */
  async findMySpaces(userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const spaces = await this.prisma.space.findMany({
      where: { id_owner },
      include: {
        detail_reservasi: {
          take: 5,
          orderBy: { id: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    });

    return {
      success: true,
      total: spaces.length,
      data: spaces,
    };
  }

  /**
   * Detail satu ruangan/meja
   */
  async findOne(id: number) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            nama_coworking: true,
            nama_pemilik: true,
            telp: true,
            alamat: true,
          },
        },
      },
    });

    if (!space) {
      throw new NotFoundException('Meja/ruangan tidak ditemukan');
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayReservations = await this.prisma.reservasi.findMany({
      where: {
        detailReservasi: { id_space: id },
        status: { not: 'dibatalkan' },
        tanggal_reservasi: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        id: true,
        kode_tiket: true,
        status: true,
        jam_mulai: true,
        jam_selesai: true,
        durasi_jam: true,
      },
      orderBy: { jam_mulai: 'asc' },
    });

    const activeRes = todayReservations.find((r) => r.status === 'aktif');
    const pendingRes = todayReservations.find((r) => r.status === 'Belum_Dikonfirmasi');
    const reservedRes = todayReservations.find((r) => r.status === 'Disetujui');

    let live_status: 'AVAILABLE' | 'IN_USE' | 'RESERVED' | 'PENDING' = 'AVAILABLE';
    let status_label = 'Tersedia';

    if (activeRes) {
      live_status = 'IN_USE';
      status_label = 'Sedang Digunakan';
    } else if (pendingRes) {
      live_status = 'PENDING';
      status_label = 'Reserved / Pending (Bayar di Kasir)';
    } else if (reservedRes) {
      live_status = 'RESERVED';
      status_label = 'Reserved';
    }

    return {
      success: true,
      data: {
        ...space,
        live_status,
        status_label,
        active_session: activeRes || pendingRes || reservedRes || null,
        today_reservations: todayReservations,
      },
    };
  }

  /**
   * Update katalog meja/ruang (dengan verifikasi multi-tenant)
   */
  async update(id: number, updateSpaceDto: UpdateSpaceDto, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const space = await this.prisma.space.findUnique({ where: { id } });

    if (!space) {
      throw new NotFoundException('Meja/ruangan tidak ditemukan');
    }

    if (space.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak memiliki hak untuk mengedit space milik gerai lain');
    }

    const updated = await this.prisma.space.update({
      where: { id },
      data: {
        ...(updateSpaceDto.nama_space && { nama_space: updateSpaceDto.nama_space }),
        ...(updateSpaceDto.harga_per_jam !== undefined && {
          harga_per_jam: Number(updateSpaceDto.harga_per_jam),
        }),
        ...(updateSpaceDto.tipe && { tipe: updateSpaceDto.tipe as any }),
        ...(updateSpaceDto.kapasitas !== undefined && {
          kapasitas: Number(updateSpaceDto.kapasitas),
        }),
        ...(updateSpaceDto.foto !== undefined && { foto: updateSpaceDto.foto }),
        ...(updateSpaceDto.deskripsi && { deskripsi: updateSpaceDto.deskripsi }),
      },
      include: {
        owner: true,
      },
    });

    this.eventsService.emit('SPACE_UPDATED', {
      action: 'UPDATED',
      space: updated,
      id_owner,
    });

    return {
      success: true,
      message: 'Data meja/ruangan berhasil diperbarui',
      data: updated,
    };
  }

  /**
   * Hapus meja/ruang (dengan verifikasi multi-tenant)
   */
  async remove(id: number, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const space = await this.prisma.space.findUnique({ where: { id } });

    if (!space) {
      throw new NotFoundException('Meja/ruangan tidak ditemukan');
    }

    if (space.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak memiliki hak untuk menghapus space milik gerai lain');
    }

    // Cek apakah meja memiliki reservasi aktif yang belum selesai
    const activeBooking = await this.prisma.detail_reservasi.findFirst({
      where: {
        id_space: id,
        reservasi: {
          status: { in: ['Belum_Dikonfirmasi', 'Disetujui', 'aktif'] },
        },
      },
    });

    if (activeBooking) {
      throw new BadRequestException(
        'Meja/ruangan ini tidak dapat dihapus karena masih memiliki jadwal reservasi aktif atau pending.',
      );
    }

    try {
      await this.prisma.space.delete({ where: { id } });
    } catch (err: any) {
      if (err.code === 'P2003') {
        throw new BadRequestException(
          'Meja/ruangan ini memiliki riwayat data reservasi transaksi masa lalu, sehingga tidak dapat dihapus permanen dari sistem.',
        );
      }
      throw err;
    }

    this.eventsService.emit('SPACE_UPDATED', {
      action: 'DELETED',
      id,
      id_owner,
    });

    return {
      success: true,
      message: 'Meja/ruangan berhasil dihapus dari katalog',
    };
  }

  /**
   * MESIN CEK KETERSEDIAAN (Anti Double-Booking Engine)
   * Memeriksa bentrok jadwal secara real-time pada meja yang sama.
   */
  async checkAvailability(id: number, dto: CheckAvailabilityDto) {
    const space = await this.prisma.space.findUnique({ where: { id } });
    if (!space) {
      throw new NotFoundException('Meja/ruangan tidak ditemukan');
    }

    const { start, end } = this.parseStartAndEnd(
      dto.tanggal_reservasi,
      dto.jam_mulai,
      dto.durasi_jam,
    );

    // Cari reservasi yang bertabrakan pada meja yang sama
    // Overlap: (existing.jam_mulai < requested.end) && (existing.jam_selesai > requested.start)
    // Dan status BUKAN 'dibatalkan'
    const conflictingReservations = await this.prisma.reservasi.findMany({
      where: {
        detailReservasi: {
          id_space: id,
        },
        status: {
          not: 'dibatalkan',
        },
        AND: [
          {
            jam_mulai: {
              lt: end,
            },
          },
          {
            OR: [
              {
                jam_selesai: {
                  gt: start,
                },
              },
              // Fallback untuk record lama yang mungkin belum memiliki field jam_selesai
              {
                jam_selesai: null,
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        kode_tiket: true,
        jam_mulai: true,
        jam_selesai: true,
        durasi_jam: true,
        status: true,
      },
    });

    const isAvailable = conflictingReservations.length === 0;
    const pendingConflict = conflictingReservations.find((r) => r.status === 'Belum_Dikonfirmasi');
    const inUseConflict = conflictingReservations.find((r) => r.status === 'aktif');

    let conflictMessage = 'Meja/ruangan tersedia pada jam tersebut';
    let conflictStatus: 'AVAILABLE' | 'PENDING' | 'RESERVED' | 'IN_USE' = 'AVAILABLE';

    if (!isAvailable) {
      if (pendingConflict) {
        conflictStatus = 'PENDING';
        conflictMessage =
          'Meja ini sudah di-booking dan berstatus Reserved / Pending (menunggu pembayaran di kasir oleh member lain).';
      } else if (inUseConflict) {
        conflictStatus = 'IN_USE';
        conflictMessage = 'Meja sedang aktif digunakan pada rentang jam tersebut.';
      } else {
        conflictStatus = 'RESERVED';
        conflictMessage = 'Meja sudah dipesan/terjadwal (Reserved) pada rentang jam tersebut.';
      }
    }

    return {
      success: true,
      id_space: id,
      nama_space: space.nama_space,
      is_available: isAvailable,
      conflict_status: conflictStatus,
      requested_slot: {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        durasi_jam: dto.durasi_jam,
      },
      conflict_count: conflictingReservations.length,
      conflicts: conflictingReservations,
      message: conflictMessage,
    };
  }

  /**
   * Mengambil overview gerai mitra, daftar meja, dan live queue meja sedang digunakan
   */
  async getMitraOverview(ownerId: number) {
    const owner = await this.prisma.space_owner.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        nama_coworking: true,
        nama_pemilik: true,
        telp: true,
        alamat: true,
      },
    });

    if (!owner) {
      throw new NotFoundException('Mitra gerai tidak ditemukan');
    }

    const spaces = await this.prisma.space.findMany({
      where: { id_owner: ownerId },
      orderBy: { nama_space: 'asc' },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayReservations = await this.prisma.reservasi.findMany({
      where: {
        id_owner: ownerId,
        status: { not: 'dibatalkan' },
        tanggal_reservasi: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        member: {
          select: {
            nama_member: true,
            Instansi: true,
          },
        },
        detailReservasi: {
          include: {
            space: true,
          },
        },
      },
      orderBy: { jam_mulai: 'asc' },
    });

    // Map status per space & buat queue meja sedang digunakan / pending kasir
    const queueList: any[] = [];
    const spacesWithStatus = spaces.map((space) => {
      const spaceReservations = todayReservations.filter(
        (r) => r.detailReservasi?.id_space === space.id,
      );

      const activeRes = spaceReservations.find((r) => r.status === 'aktif');
      const pendingRes = spaceReservations.find((r) => r.status === 'Belum_Dikonfirmasi');
      const reservedRes = spaceReservations.find((r) => r.status === 'Disetujui');

      let status: 'AVAILABLE' | 'IN_USE' | 'RESERVED' | 'PENDING' = 'AVAILABLE';
      let statusLabel = 'Tersedia';

      if (activeRes) {
        status = 'IN_USE';
        statusLabel = 'Sedang Digunakan';
        queueList.push({
          space_id: space.id,
          nama_space: space.nama_space,
          tipe: space.tipe,
          kapasitas: space.kapasitas,
          status: 'IN_USE',
          status_label: 'Sedang Digunakan',
          kode_tiket: activeRes.kode_tiket,
          nama_penyewa: activeRes.member?.nama_member || 'Pengguna',
          instansi: activeRes.member?.Instansi || '-',
          jam_mulai: activeRes.jam_mulai,
          jam_selesai: activeRes.jam_selesai,
          durasi_jam: activeRes.durasi_jam,
          next_slot: pendingRes || reservedRes
            ? {
                jam_mulai: (pendingRes || reservedRes)!.jam_mulai,
                jam_selesai: (pendingRes || reservedRes)!.jam_selesai,
                kode_tiket: (pendingRes || reservedRes)!.kode_tiket,
                status: (pendingRes || reservedRes)!.status,
              }
            : null,
        });
      } else if (pendingRes) {
        status = 'PENDING';
        statusLabel = 'Reserved / Pending';
        queueList.push({
          space_id: space.id,
          nama_space: space.nama_space,
          tipe: space.tipe,
          kapasitas: space.kapasitas,
          status: 'PENDING',
          status_label: 'Reserved / Pending (Bayar di Kasir)',
          kode_tiket: pendingRes.kode_tiket,
          nama_penyewa: pendingRes.member?.nama_member || 'Pengguna',
          instansi: pendingRes.member?.Instansi || '-',
          jam_mulai: pendingRes.jam_mulai,
          jam_selesai: pendingRes.jam_selesai,
          durasi_jam: pendingRes.durasi_jam,
          next_slot: null,
        });
      } else if (reservedRes) {
        status = 'RESERVED';
        statusLabel = 'Reserved';
      }

      return {
        ...space,
        live_status: status,
        status_label: statusLabel,
        active_session: activeRes || pendingRes || reservedRes
          ? {
              kode_tiket: (activeRes || pendingRes || reservedRes)!.kode_tiket,
              jam_mulai: (activeRes || pendingRes || reservedRes)!.jam_mulai,
              jam_selesai: (activeRes || pendingRes || reservedRes)!.jam_selesai,
              durasi_jam: (activeRes || pendingRes || reservedRes)!.durasi_jam,
              status: (activeRes || pendingRes || reservedRes)!.status,
            }
          : null,
        today_queue: spaceReservations.map((sr) => ({
          id: sr.id,
          kode_tiket: sr.kode_tiket,
          status: sr.status,
          jam_mulai: sr.jam_mulai,
          jam_selesai: sr.jam_selesai,
          durasi_jam: sr.durasi_jam,
        })),
      };
    });

    const inUseCount = spacesWithStatus.filter((s) => s.live_status === 'IN_USE').length;
    const pendingCount = spacesWithStatus.filter((s) => s.live_status === 'PENDING').length;
    const reservedCount = spacesWithStatus.filter((s) => s.live_status === 'RESERVED').length;
    const availableCount = spacesWithStatus.filter((s) => s.live_status === 'AVAILABLE').length;

    return {
      success: true,
      data: {
        mitra: owner,
        spaces: spacesWithStatus,
        in_use_queue: queueList,
        stats: {
          total_meja: spaces.length,
          in_use: inUseCount,
          pending: pendingCount,
          reserved: reservedCount,
          available: availableCount,
        },
      },
    };
  }
}
