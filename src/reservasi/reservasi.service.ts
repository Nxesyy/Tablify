import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import QRCode from 'qrcode';
import { CreateReservasiDto } from './dto/create-reservasi.dto.js';
import {
  StatusReservasiEnum,
  UpdateStatusReservasiDto,
} from './dto/update-status-reservasi.dto.js';
import { CheckInOutDto } from './dto/checkin-checkout.dto.js';
import { ExtendReservasiDto } from './dto/extend-reservasi.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EventsService } from '../events/events.service.js';

@Injectable()
export class ReservasiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  private async getMemberByUserId(userId: number) {
    const member = await this.prisma.member.findUnique({
      where: { id_user: userId },
    });
    if (!member) {
      throw new ForbiddenException('Hanya akun Member yang dapat melakukan pemesanan meja');
    }
    return member;
  }

  private async getOwnerIdByUserId(userId: number): Promise<number> {
    const owner = await this.prisma.space_owner.findUnique({
      where: { id_user: userId },
    });
    if (!owner) {
      throw new ForbiddenException(
        'Hanya pengelola space/admin kafe yang berwenang mengakses data operasional gerai',
      );
    }
    return owner.id;
  }


  private parseDates(
    tanggal: string,
    jamMulai: string,
    durasiJam?: number,
    jamSelesai?: string,
  ) {
    let start: Date;
    if (jamMulai.includes('T')) {
      start = new Date(jamMulai);
    } else {
      const [hours, minutes] = jamMulai.split(':').map(Number);
      const cleanDate = tanggal.split('T')[0];
      start = new Date(`${cleanDate}T${String(hours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}:00`);

      // Penanganan jam mulai tengah malam (00:00):
      // Jika reservasi untuk hari ini dan waktu server saat ini sudah siang/sore/malam (>= 12:00),
      // maka maksud user adalah jam 00:00 tengah malam nanti (hari esok, +24 jam), bukan tadi subuh.
      if (hours === 0 && (minutes || 0) === 0) {
        const now = new Date();
        const cleanToday = now.toISOString().slice(0, 10);
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if ((cleanDate === cleanToday || cleanDate === localToday) && now.getHours() >= 12) {
          start = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        }
      }
    }

    if (isNaN(start.getTime())) {
      throw new BadRequestException('Format tanggal atau jam mulai tidak valid');
    }

    let end: Date;
    let computedDuration: number;

    if (jamSelesai) {
      if (jamSelesai.includes('T')) {
        end = new Date(jamSelesai);
      } else {
        const [endH, endM] = jamSelesai.split(':').map(Number);
        const cleanDate = tanggal.split('T')[0];
        end = new Date(`${cleanDate}T${String(endH).padStart(2, '0')}:${String(endM || 0).padStart(2, '0')}:00`);

        // Penanganan jam selesai tengah malam (00:00) atau melintasi tengah malam:
        // Jika end <= start, maka waktu selesai berada di hari berikutnya (+24 jam)
        if (end.getTime() <= start.getTime()) {
          end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        }
      }

      if (isNaN(end.getTime())) {
        throw new BadRequestException('Format jam selesai tidak valid');
      }

      if (end.getTime() <= start.getTime()) {
        throw new BadRequestException('Jam selesai harus lebih besar dari jam mulai');
      }

      const diffMs = end.getTime() - start.getTime();
      computedDuration = durasiJam && durasiJam > 0
        ? durasiJam
        : Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    } else if (durasiJam && durasiJam > 0) {
      computedDuration = durasiJam;
      end = new Date(start.getTime() + durasiJam * 60 * 60 * 1000);
    } else {
      computedDuration = 1;
      end = new Date(start.getTime() + 1 * 60 * 60 * 1000);
    }

    const dateOnly = new Date(tanggal.split('T')[0] + 'T00:00:00.000Z');

    return { start, end, dateOnly, durasiJam: computedDuration };
  }

  private generateKodeTiket(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `TBL-${dateStr}-${rand}`;
  }

  private async generateQRCode(payload: any): Promise<string> {
    try {
      return await QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 6,
      });
    } catch {
      return '';
    }
  }

  async checkout(dto: CreateReservasiDto, userId: number) {
    const member = await this.getMemberByUserId(userId);

    const space = await this.prisma.space.findUnique({
      where: { id: dto.id_space },
      include: { owner: true },
    });

    if (!space) {
      throw new NotFoundException('Meja/ruangan yang dipilih tidak ditemukan');
    }

    const { start, end, dateOnly, durasiJam } = this.parseDates(
      dto.tanggal_reservasi,
      dto.jam_mulai,
      dto.durasi_jam,
      dto.jam_selesai,
    );

    // ENGINE ANTI DOUBLE-BOOKING:
    // Cek apakah ada jadwal yang bertabrakan pada meja yang sama
    const conflict = await this.prisma.reservasi.findFirst({
      where: {
        detailReservasi: {
          id_space: dto.id_space,
        },
        status: {
          not: 'dibatalkan',
        },
        AND: [
          { jam_mulai: { lt: end } },
          {
            OR: [
              { jam_selesai: { gt: start } },
              { jam_selesai: null },
            ],
          },
        ],
      },
    });

    if (conflict) {
      const isPendingKasir = conflict.status === 'Belum_Dikonfirmasi';
      const statusKeterangan = isPendingKasir
        ? 'berstatus Reserved / Pending (menunggu pembayaran di kasir oleh member lain)'
        : 'sudah dipesan / disetujui untuk member lain';
      throw new BadRequestException(
        `Meja/ruangan ini sedang ${statusKeterangan} pada rentang jam tersebut. Silakan pilih jam atau meja lain.`,
      );
    }

    // Hitung HARGA
    const tarif_per_jam = space.harga_per_jam;
    const total_jam = durasiJam;
    const subtotal = tarif_per_jam * total_jam;
    let potongan = 0;
    let id_diskon: number | null = null;
    let diskonApplied: any = null;

    // VALIDASI PROMO OTOMATIS
    if (dto.kode_diskon) {
      const kodeClean = dto.kode_diskon.trim().toUpperCase();
      const diskon = await this.prisma.diskon.findFirst({
        where: {
          id_owner: space.id_owner,
          kode_diskon: kodeClean,
        },
      });

      if (diskon) {
        const now = new Date();
        if (now >= diskon.tanggal_awal && now <= diskon.tanggal_akhir) {
          id_diskon = diskon.id;
          potongan = (subtotal * diskon.presentase_diskon) / 100;
          diskonApplied = {
            kode: diskon.kode_diskon,
            nama: diskon.nama_diskkon,
            persen: diskon.presentase_diskon,
          };
        } else {
          throw new BadRequestException(`Kupon promo '${kodeClean}' telah kedaluwarsa atau belum berlaku.`);
        }
      } else {
        throw new BadRequestException(`Kupon promo '${kodeClean}' tidak berlaku untuk gerai ini.`);
      }
    }

    const total_harga = Math.max(0, subtotal - potongan);
    const kode_tiket = this.generateKodeTiket();
    const reservasi = await this.prisma.$transaction(async (tx) => {
      const newRes = await tx.reservasi.create({
        data: {
          kode_tiket,
          tanggal_reservasi: dateOnly,
          jam_mulai: start,
          jam_selesai: end,
          durasi_jam: total_jam,
          id_owner: space.id_owner,
          id_member: member.id,
          status: 'Belum_Dikonfirmasi',
        },
      });

      await tx.detail_reservasi.create({
        data: {
          id_reservasi: newRes.id,
          id_space: space.id,
          id_member: member.id,
          id_diskon,
          tarif_per_jam,
          total_jam,
          subtotal,
          potongan,
          total_harga,
        },
      });

      return newRes;
    });

    const qrPayload = {
      kode_tiket,
      id_reservasi: reservasi.id,
      space: space.nama_space,
      member: member.nama_member,
      mulai: start.toISOString(),
      selesai: end.toISOString(),
    };
    const qrCodeDataUrl = await this.generateQRCode(qrPayload);

    // Broadcast event real-time ke WebSocket & SSE
    this.eventsService.emit('RESERVATION_CREATED', {
      id_reservasi: reservasi.id,
      kode_tiket,
      id_space: space.id,
      id_owner: space.id_owner,
      status: reservasi.status,
      nama_space: space.nama_space,
      nama_member: member.nama_member,
      jam_mulai: start,
      jam_selesai: end,
    });

    // LOGIKA GATEWAY PEMBAYARAN DIGITAL & KASIR
    const paymentMethod = dto.metode_pembayaran || 'KASIR';
    let gatewayData: any = null;

    if (paymentMethod !== 'KASIR') {
      const now = new Date();
      const expiredAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 menit
      const trxId = `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      if (paymentMethod === 'QRIS') {
        const qrisPayload = `00020101021226580014ID.LINKAJA.WWW01189360099900000000010215${trxId}51440014ID.CO.QRIS.WWW0215ID10200000000000303UME5204581253033605802ID5913${(space.owner.nama_coworking || 'TABLIFY').slice(0, 25)}6007JAKARTA62070703A016304`;
        const qrisQr = await this.generateQRCode(qrisPayload);
        gatewayData = {
          tipe: 'QRIS',
          metode: 'QRIS Dinamis',
          transaksi_id: trxId,
          merchant: space.owner.nama_coworking || 'Tablify Mitra',
          total_bayar: total_harga,
          qr_code: qrisQr,
          qris_payload: qrisPayload,
          expired_at: expiredAt.toISOString(),
          petunjuk: [
            'Buka aplikasi BCA Mobile, Livin, GoPay, OVO, Dana, atau mobile banking Anda',
            'Pilih menu QRIS / Scan QR',
            'Arahkan kamera ke QR Code di atas',
            'Pastikan nama merchant dan nominal sesuai, lalu konfirmasi pembayaran',
          ],
        };
      } else if (paymentMethod.startsWith('VA_')) {
        const bank = paymentMethod.replace('VA_', '');
        const bankPrefix: Record<string, string> = {
          BCA: '8808',
          MANDIRI: '8908',
          BNI: '8818',
          BRI: '8828',
        };
        const prefix = bankPrefix[bank] || '8808';
        const vaNumber = `${prefix}${String(member.id).padStart(4, '0')}${Date.now().toString().slice(-6)}`;
        gatewayData = {
          tipe: 'VIRTUAL_ACCOUNT',
          metode: `Virtual Account ${bank}`,
          bank,
          transaksi_id: trxId,
          va_number: vaNumber,
          nama_rekening: `TABLIFY - ${member.nama_member.toUpperCase()}`,
          total_bayar: total_harga,
          expired_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          petunjuk: [
            `Buka aplikasi Mobile Banking atau ATM ${bank}`,
            'Pilih menu Transfer > Virtual Account',
            `Masukkan nomor Virtual Account: ${vaNumber}`,
            'Periksa rincian tagihan dan selesaikan pembayaran',
          ],
        };
      } else {
        // E-Wallet (GOPAY, OVO, DANA, SHOPEEPAY)
        gatewayData = {
          tipe: 'EWALLET',
          metode: paymentMethod,
          transaksi_id: trxId,
          merchant: space.owner.nama_coworking || 'Tablify Mitra',
          total_bayar: total_harga,
          nomor_tujuan: member.telp || '0812-XXXX-XXXX',
          deep_link: `https://pay.tablify.id/ewallet/${paymentMethod.toLowerCase()}?trx=${trxId}`,
          expired_at: expiredAt.toISOString(),
          petunjuk: [
            `Buka aplikasi ${paymentMethod} pada ponsel Anda`,
            'Cek notifikasi tagihan atau konfirmasi transaksi pending',
            'Pastikan nominal sesuai dan masukkan PIN Anda untuk menyelesaikan pembayaran',
          ],
        };
      }
    }

    const message =
      paymentMethod === 'KASIR'
        ? 'Reservasi meja berhasil dibuat. Status: Booking Belum Aktif. Silakan tunjukkan e-tiket ke kasir/resepsionis untuk konfirmasi dan pembayaran.'
        : 'Tagihan pembayaran berhasil dibuat. Silakan selesaikan pembayaran untuk mengaktifkan reservasi.';

    return {
      success: true,
      message,
      data: {
        id_reservasi: reservasi.id,
        kode_tiket,
        status: reservasi.status,
        gerai: space.owner.nama_coworking,
        space: space.nama_space,
        tipe: space.tipe,
        kapasitas: space.kapasitas,
        jam_mulai: start,
        jam_selesai: end,
        durasi_jam: total_jam,
        metode_pembayaran: paymentMethod,
        rincian_pembayaran: {
          tarif_per_jam,
          subtotal,
          diskon: diskonApplied,
          potongan,
          total_bayar: total_harga,
        },
        qr_code: qrCodeDataUrl,
        gateway: gatewayData,
      },
    };
  }

  async findMyHistory(
    userId: number,
    query?: { bulan?: number; tahun?: number; status?: string },
  ) {
    const member = await this.getMemberByUserId(userId);
    const whereClause: any = { id_member: member.id };

    if (query?.status) {
      whereClause.status = query.status;
    }

    if (query?.bulan && query?.tahun) {
      const year = Number(query.tahun);
      const month = Number(query.bulan);
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      whereClause.tanggal_reservasi = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else if (query?.tahun) {
      const year = Number(query.tahun);
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      whereClause.tanggal_reservasi = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const list = await this.prisma.reservasi.findMany({
      where: whereClause,
      include: {
        space_owner: {
          select: {
            nama_coworking: true,
            nama_pemilik: true,
            telp: true,
          },
        },
        detailReservasi: {
          include: {
            space: true,
            diskon: true,
          },
        },
        review: true,
      },
      orderBy: { id: 'desc' },
    });

    return {
      success: true,
      total: list.length,
      data: list,
    };
  }

  async findOwnerReservations(
    userId: number,
    query?: { bulan?: number; tahun?: number; status?: string },
  ) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const whereClause: any = { id_owner };

    if (query?.status) {
      whereClause.status = query.status;
    }

    if (query?.bulan && query?.tahun) {
      const year = Number(query.tahun);
      const month = Number(query.bulan);
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      whereClause.tanggal_reservasi = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else if (query?.tahun) {
      const year = Number(query.tahun);
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      whereClause.tanggal_reservasi = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const list = await this.prisma.reservasi.findMany({
      where: whereClause,
      include: {
        member: {
          select: {
            nama_member: true,
            Instansi: true,
            telp: true,
            foto: true,
          },
        },
        detailReservasi: {
          include: {
            space: true,
            diskon: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return {
      success: true,
      total: list.length,
      data: list,
    };
  }

  async findOne(id: number, userId: number, role: string) {
    const reservasi = await this.prisma.reservasi.findUnique({
      where: { id },
      include: {
        member: true,
        space_owner: true,
        detailReservasi: {
          include: {
            space: true,
            diskon: true,
          },
        },
      },
    });

    if (!reservasi) {
      throw new NotFoundException('Data reservasi tidak ditemukan');
    }

    // Validasi multi-tenant data isolation
    if (role === 'MEMBER') {
      const member = await this.getMemberByUserId(userId);
      if (reservasi.id_member !== member.id) {
        throw new ForbiddenException('Anda tidak memiliki akses ke reservasi pengguna lain');
      }
    } else if (role === 'ADMIN_SPACE') {
      const id_owner = await this.getOwnerIdByUserId(userId);
      if (reservasi.id_owner !== id_owner) {
        throw new ForbiddenException('Anda tidak memiliki akses ke reservasi gerai lain');
      }
    }

    return {
      success: true,
      data: reservasi,
    };
  }

  async getTicket(kodeTiket: string) {
    const reservasi = await this.prisma.reservasi.findUnique({
      where: { kode_tiket: kodeTiket },
      include: {
        member: {
          select: { nama_member: true, Instansi: true, telp: true },
        },
        space_owner: {
          select: { nama_coworking: true, nama_pemilik: true, telp: true, alamat: true },
        },
        detailReservasi: {
          include: { space: true, diskon: true },
        },
      },
    });

    if (!reservasi) {
      throw new NotFoundException('Tiket reservasi tidak ditemukan');
    }

    const qrPayload = {
      kode_tiket: reservasi.kode_tiket,
      id_reservasi: reservasi.id,
      nama_space: reservasi.detailReservasi?.space?.nama_space,
      nama_member: reservasi.member.nama_member,
      mulai: reservasi.jam_mulai,
      selesai: reservasi.jam_selesai,
      status: reservasi.status,
    };
    const qrCodeImage = await this.generateQRCode(qrPayload);

    return {
      success: true,
      data: {
        ...reservasi,
        qr_code: qrCodeImage,
      },
    };
  }

  async cancelByMember(id: number, userId: number) {
    const member = await this.getMemberByUserId(userId);
    const reservasi = await this.prisma.reservasi.findUnique({ where: { id } });

    if (!reservasi) {
      throw new NotFoundException('Reservasi tidak ditemukan');
    }

    if (reservasi.id_member !== member.id) {
      throw new ForbiddenException('Anda tidak dapat membatalkan reservasi milik orang lain');
    }

    // Member hanya boleh membatalkan jika status belum aktif/selesai
    if (reservasi.status === 'aktif' || reservasi.status === 'selesai') {
      throw new BadRequestException(
        `Reservasi dengan status '${reservasi.status}' tidak dapat dibatalkan secara mandiri`,
      );
    }

    if (reservasi.status === 'dibatalkan') {
      return { success: true, message: 'Reservasi memang sudah dibatalkan sebelumnya' };
    }

    const updated = await this.prisma.reservasi.update({
      where: { id },
      data: { status: 'dibatalkan' },
    });

    return {
      success: true,
      message: 'Reservasi berhasil dibatalkan',
      data: updated,
    };
  }

  /**
   * 7. STATE MACHINE STATUS RESERVASI (Admin Space)
   * Alur: Belum_Dikonfirmasi -> Disetujui -> aktif -> selesai (atau dibatalkan)
   */
  async updateStatus(
    id: number,
    dto: UpdateStatusReservasiDto,
    userId: number,
  ) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const reservasi = await this.prisma.reservasi.findUnique({ where: { id } });

    if (!reservasi) {
      throw new NotFoundException('Data reservasi tidak ditemukan');
    }

    if (reservasi.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak berhak mengubah reservasi milik gerai lain');
    }

    const currentStatus = reservasi.status;
    const targetStatus = dto.status;

    // VALIDASI STATE TRANSITION
    const validTransitions: Record<string, string[]> = {
      Belum_Dikonfirmasi: ['Disetujui', 'dibatalkan'],
      Disetujui: ['aktif', 'dibatalkan'],
      aktif: ['selesai'],
      selesai: [],
      dibatalkan: [],
    };

    if (!validTransitions[currentStatus]?.includes(targetStatus)) {
      throw new BadRequestException(
        `Transisi status tidak diizinkan: Dari '${currentStatus}' ke '${targetStatus}'`,
      );
    }

    const updated = await this.prisma.reservasi.update({
      where: { id },
      data: { status: targetStatus as any },
    });

    this.eventsService.emit('RESERVATION_STATUS_CHANGED', {
      id: updated.id,
      status: targetStatus,
      id_owner: reservasi.id_owner,
    });

    return {
      success: true,
      message: `Status reservasi berhasil diubah dari '${currentStatus}' menjadi '${targetStatus}'`,
      data: updated,
    };
  }

  /**
   * 8. FAST CHECK-IN DI MEJA RESEPSIONIS (via Kode Tiket / ID)
   */
  async checkIn(dto: CheckInOutDto, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);

    const whereClause: any = {};
    if (dto.kode_tiket) {
      whereClause.kode_tiket = dto.kode_tiket.trim();
    } else if (dto.id_reservasi) {
      whereClause.id = Number(dto.id_reservasi);
    } else {
      throw new BadRequestException('Sertakan kode_tiket atau id_reservasi untuk check-in');
    }

    const res = await this.prisma.reservasi.findFirst({
      where: whereClause,
      include: {
        member: true,
        detailReservasi: { include: { space: true } },
      },
    });

    if (!res) {
      throw new NotFoundException('Data reservasi tamu tidak ditemukan');
    }

    if (res.id_owner !== id_owner) {
      throw new ForbiddenException('Tiket reservasi ini bukan untuk gerai Anda');
    }

    if (res.status === 'aktif') {
      return {
        success: true,
        message: 'Tamu sudah dalam status check-in aktif',
        data: res,
      };
    }

    if (res.status === 'Belum_Dikonfirmasi') {
      throw new BadRequestException(
        'Tamu belum menyelesaikan pembayaran (Status: Belum Dikonfirmasi). Silakan lakukan konfirmasi pelunasan pembayaran di kasir terlebih dahulu.',
      );
    }

    if (res.status === 'selesai' || res.status === 'dibatalkan') {
      throw new BadRequestException(
        `Tidak dapat check-in karena status tiket sudah '${res.status}'`,
      );
    }

    const updated = await this.prisma.reservasi.update({
      where: { id: res.id },
      data: { status: 'aktif' },
      include: {
        member: true,
        detailReservasi: { include: { space: true } },
      },
    });

    this.eventsService.emit('CHECK_IN', {
      id: updated.id,
      status: 'aktif',
      id_owner: res.id_owner,
      id_space: updated.detailReservasi?.id_space,
      nama_member: updated.member.nama_member,
      nama_space: updated.detailReservasi?.space?.nama_space,
    });
    this.eventsService.emit('RESERVATION_STATUS_CHANGED', {
      id: updated.id,
      status: 'aktif',
      id_owner: res.id_owner,
    });

    return {
      success: true,
      message: `Tamu ${updated.member.nama_member} berhasil check-in pada meja ${updated.detailReservasi?.space?.nama_space}`,
      data: updated,
    };
  }

  /**
   * 9. FAST CHECK-OUT DI MEJA RESEPSIONIS (via Kode Tiket / ID)
   */
  async checkOut(dto: CheckInOutDto, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);

    const whereClause: any = {};
    if (dto.kode_tiket) {
      whereClause.kode_tiket = dto.kode_tiket.trim();
    } else if (dto.id_reservasi) {
      whereClause.id = Number(dto.id_reservasi);
    } else {
      throw new BadRequestException('Sertakan kode_tiket atau id_reservasi untuk check-out');
    }

    const res = await this.prisma.reservasi.findFirst({
      where: whereClause,
      include: {
        member: true,
        detailReservasi: { include: { space: true } },
      },
    });

    if (!res) {
      throw new NotFoundException('Data reservasi tamu tidak ditemukan');
    }

    if (res.id_owner !== id_owner) {
      throw new ForbiddenException('Tiket reservasi ini bukan untuk gerai Anda');
    }

    if (res.status === 'selesai') {
      return {
        success: true,
        message: 'Tamu sudah melakukan check-out sebelumnya',
        data: res,
      };
    }

    if (res.status === 'dibatalkan') {
      throw new BadRequestException('Tiket reservasi ini telah dibatalkan');
    }

    const updated = await this.prisma.reservasi.update({
      where: { id: res.id },
      data: { status: 'selesai' },
      include: {
        member: true,
        detailReservasi: { include: { space: true } },
      },
    });

    this.eventsService.emit('CHECK_OUT', {
      id: updated.id,
      status: 'selesai',
      id_owner: res.id_owner,
      id_space: updated.detailReservasi?.id_space,
      nama_member: updated.member.nama_member,
      nama_space: updated.detailReservasi?.space?.nama_space,
    });
    this.eventsService.emit('RESERVATION_STATUS_CHANGED', {
      id: updated.id,
      status: 'selesai',
      id_owner: res.id_owner,
    });

    return {
      success: true,
      message: `Tamu ${updated.member.nama_member} berhasil check-out dari meja ${updated.detailReservasi?.space?.nama_space}. Selesai!`,
      data: updated,
    };
  }

  /**
   * 10. VERIFIKASI CEPAT TIKET DI RESEPSIONIS (Scan QR Code)
   */
  async verifyTicket(kodeTiket: string, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);

    const res = await this.prisma.reservasi.findUnique({
      where: { kode_tiket: kodeTiket.trim() },
      include: {
        member: true,
        detailReservasi: {
          include: { space: true, diskon: true },
        },
      },
    });

    if (!res) {
      return {
        is_valid: false,
        message: 'Kode tiket tidak terdaftar di sistem',
      };
    }

    if (res.id_owner !== id_owner) {
      return {
        is_valid: false,
        message: 'Tiket ini terdaftar di gerai kafe/coworking lain, bukan di gerai Anda',
      };
    }

    return {
      is_valid: true,
      message: 'Tiket terverifikasi valid',
      data: res,
    };
  }

  /**
   * 11. PERPANJANGAN DURASI FLEKSIBEL (Extend Booking Engine)
   * Hanya untuk member pemilik tiket dan status reservasi sedang 'aktif'
   */
  async extendBooking(id: number, dto: ExtendReservasiDto, userId: number) {
    const member = await this.getMemberByUserId(userId);

    const reservasi = await this.prisma.reservasi.findUnique({
      where: { id },
      include: {
        detailReservasi: {
          include: {
            space: true,
          },
        },
      },
    });

    if (!reservasi) {
      throw new NotFoundException('Data reservasi tidak ditemukan');
    }

    if (reservasi.id_member !== member.id) {
      throw new ForbiddenException('Anda tidak berwenang memperpanjang reservasi milik orang lain');
    }

    // Validasi ketat: Hanya reservasi yang sedang aktif yang boleh diperpanjang
    if (reservasi.status !== 'aktif') {
      throw new BadRequestException(
        `Perpanjangan waktu sewa hanya dapat dilakukan jika sesi reservasi sedang 'aktif'. Status saat ini: '${reservasi.status}'`,
      );
    }

    const detail = reservasi.detailReservasi;
    if (!detail || !detail.id_space) {
      throw new BadRequestException('Informasi detail meja reservasi tidak lengkap');
    }

    // Hitung waktu selesai saat ini
    const currentEnd =
      reservasi.jam_selesai ||
      new Date(reservasi.jam_mulai.getTime() + reservasi.durasi_jam * 60 * 60 * 1000);

    const durasiTambahan = dto.durasi_tambahan;
    const newEndTime = new Date(currentEnd.getTime() + durasiTambahan * 60 * 60 * 1000);

    // ANTI-OVERLAP ENGINE: Cek apakah ada jadwal booking lain yang bertabrakan di slot tambahan
    const conflict = await this.prisma.reservasi.findFirst({
      where: {
        id: { not: id },
        detailReservasi: {
          id_space: detail.id_space,
        },
        status: {
          not: 'dibatalkan',
        },
        AND: [
          { jam_mulai: { lt: newEndTime } },
          {
            OR: [
              { jam_selesai: { gt: currentEnd } },
              { jam_selesai: null },
            ],
          },
        ],
      },
    });

    if (conflict) {
      throw new BadRequestException(
        'Perpanjangan tidak dapat diproses karena slot jam berikutnya pada meja/ruangan ini sudah dipesan pengguna lain.',
      );
    }

    // Hitung biaya tambahan (durasi baru x tarif per jam)
    const tarifPerJam = detail.tarif_per_jam ?? detail.space?.harga_per_jam ?? 0;
    const biayaTambahan = durasiTambahan * tarifPerJam;
    const newDurasiTotal = reservasi.durasi_jam + durasiTambahan;
    const newSubtotal = (detail.subtotal ?? detail.total_harga) + biayaTambahan;
    const newTotalHarga = detail.total_harga + biayaTambahan;

    // Simpan perubahan secara transaksional
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRes = await tx.reservasi.update({
        where: { id },
        data: {
          durasi_jam: newDurasiTotal,
          jam_selesai: newEndTime,
        },
      });

      const updatedDetail = await tx.detail_reservasi.update({
        where: { id_reservasi: id },
        data: {
          total_jam: newDurasiTotal,
          subtotal: newSubtotal,
          total_harga: newTotalHarga,
        },
        include: {
          space: true,
        },
      });

      return { updatedRes, updatedDetail };
    });

    this.eventsService.emit('RESERVATION_STATUS_CHANGED', {
      id: reservasi.id,
      status: 'aktif',
      id_owner: reservasi.id_owner,
      durasi_total: newDurasiTotal,
      jam_selesai_baru: newEndTime,
    });

    return {
      success: true,
      message: `Sewa meja berhasil diperpanjang sebanyak ${durasiTambahan} jam.`,
      data: {
        id_reservasi: id,
        kode_tiket: reservasi.kode_tiket,
        space: detail.space?.nama_space,
        durasi_awal: reservasi.durasi_jam,
        durasi_tambahan: durasiTambahan,
        durasi_total: newDurasiTotal,
        jam_mulai: reservasi.jam_mulai,
        jam_selesai_lama: currentEnd,
        jam_selesai_baru: newEndTime,
        rincian_biaya: {
          tarif_per_jam: tarifPerJam,
          biaya_tambahan: biayaTambahan,
          total_bayar_sebelumnya: detail.total_harga,
          total_bayar_baru: newTotalHarga,
        },
      },
    };
  }
}

