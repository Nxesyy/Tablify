import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDiskonDto } from './dto/create-diskon.dto.js';
import { UpdateDiskonDto } from './dto/update-diskon.dto.js';
import { ValidateDiskonDto } from './dto/validate-diskon.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DiskonService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Mendapatkan id_owner dari userId admin space
   */
  private async getOwnerIdByUserId(userId: number): Promise<number> {
    const owner = await this.prisma.space_owner.findUnique({
      where: { id_user: userId },
    });
    if (!owner) {
      throw new ForbiddenException(
        'Hanya pengelola space/admin kafe yang berwenang mengelola diskon promo',
      );
    }
    return owner.id;
  }

  /**
   * Tambah promo baru khusus untuk gerai admin yang login
   */
  async create(createDiskonDto: CreateDiskonDto, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);

    const kodeFormatted = createDiskonDto.kode_diskon.trim().toUpperCase();

    // Cek apakah kode sudah digunakan di gerai ini
    const existing = await this.prisma.diskon.findFirst({
      where: {
        id_owner,
        kode_diskon: kodeFormatted,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Kode promo '${kodeFormatted}' sudah ada di gerai Anda`,
      );
    }

    const tglAwal = new Date(createDiskonDto.tanggal_awal);
    const tglAkhir = new Date(createDiskonDto.tanggal_akhir);

    if (tglAkhir < tglAwal) {
      throw new BadRequestException(
        'Tanggal akhir promo tidak boleh lebih awal dari tanggal mulai',
      );
    }

    const diskon = await this.prisma.diskon.create({
      data: {
        kode_diskon: kodeFormatted,
        nama_diskkon: createDiskonDto.nama_diskkon,
        presentase_diskon: Number(createDiskonDto.presentase_diskon),
        tanggal_awal: tglAwal,
        tanggal_akhir: tglAkhir,
        id_owner,
      },
    });

    return {
      success: true,
      message: 'Kupon diskon promo berhasil dibuat',
      data: diskon,
    };
  }

  /**
   * Ambil semua diskon milik gerai admin yang login
   */
  async findAll(userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const diskons = await this.prisma.diskon.findMany({
      where: { id_owner },
      orderBy: { id: 'desc' },
      include: {
        _count: {
          select: { detailReservasis: true },
        },
      },
    });

    return {
      success: true,
      total: diskons.length,
      data: diskons,
    };
  }

  /**
   * Ambil promo aktif suatu gerai (Dapat diakses oleh member saat checkout)
   */
  async findActiveByOwner(id_owner: number) {
    const now = new Date();
    const diskons = await this.prisma.diskon.findMany({
      where: {
        id_owner: Number(id_owner),
        tanggal_awal: { lte: now },
        tanggal_akhir: { gte: now },
      },
      select: {
        id: true,
        kode_diskon: true,
        nama_diskkon: true,
        presentase_diskon: true,
        tanggal_awal: true,
        tanggal_akhir: true,
      },
      orderBy: { presentase_diskon: 'desc' },
    });

    return {
      success: true,
      total: diskons.length,
      data: diskons,
    };
  }

  /**
   * Detail satu promo
   */
  async findOne(id: number, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const diskon = await this.prisma.diskon.findUnique({
      where: { id },
      include: {
        _count: {
          select: { detailReservasis: true },
        },
      },
    });

    if (!diskon) {
      throw new NotFoundException('Kupon diskon tidak ditemukan');
    }

    if (diskon.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak memiliki akses ke diskon gerai lain');
    }

    return {
      success: true,
      data: diskon,
    };
  }

  /**
   * Update promo
   */
  async update(id: number, updateDiskonDto: UpdateDiskonDto, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const diskon = await this.prisma.diskon.findUnique({ where: { id } });

    if (!diskon) {
      throw new NotFoundException('Kupon diskon tidak ditemukan');
    }

    if (diskon.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak memiliki akses ke diskon gerai lain');
    }

    const updated = await this.prisma.diskon.update({
      where: { id },
      data: {
        ...(updateDiskonDto.kode_diskon && {
          kode_diskon: updateDiskonDto.kode_diskon.trim().toUpperCase(),
        }),
        ...(updateDiskonDto.nama_diskkon && {
          nama_diskkon: updateDiskonDto.nama_diskkon,
        }),
        ...(updateDiskonDto.presentase_diskon !== undefined && {
          presentase_diskon: Number(updateDiskonDto.presentase_diskon),
        }),
        ...(updateDiskonDto.tanggal_awal && {
          tanggal_awal: new Date(updateDiskonDto.tanggal_awal),
        }),
        ...(updateDiskonDto.tanggal_akhir && {
          tanggal_akhir: new Date(updateDiskonDto.tanggal_akhir),
        }),
      },
    });

    return {
      success: true,
      message: 'Kupon diskon promo berhasil diperbarui',
      data: updated,
    };
  }

  /**
   * Hapus promo
   */
  async remove(id: number, userId: number) {
    const id_owner = await this.getOwnerIdByUserId(userId);
    const diskon = await this.prisma.diskon.findUnique({ where: { id } });

    if (!diskon) {
      throw new NotFoundException('Kupon diskon tidak ditemukan');
    }

    if (diskon.id_owner !== id_owner) {
      throw new ForbiddenException('Anda tidak memiliki akses ke diskon gerai lain');
    }

    await this.prisma.diskon.delete({ where: { id } });

    return {
      success: true,
      message: 'Kupon promo berhasil dihapus',
    };
  }

  /**
   * VALIDASI PROMO OTOMATIS & ENGINE KALKULASI DISKON
   * Memeriksa keberlakuan kupon saat checkout dan menghitung potongan harga.
   */
  async validatePromo(dto: ValidateDiskonDto) {
    const kodeClean = dto.kode_diskon.trim().toUpperCase();
    const dateToCheck = dto.tanggal ? new Date(dto.tanggal) : new Date();

    const diskon = await this.prisma.diskon.findFirst({
      where: {
        id_owner: Number(dto.id_owner),
        kode_diskon: kodeClean,
      },
    });

    if (!diskon) {
      return {
        is_valid: false,
        message: `Kupon '${kodeClean}' tidak ditemukan untuk gerai ini`,
      };
    }

    // Cek periode aktif
    if (dateToCheck < diskon.tanggal_awal) {
      return {
        is_valid: false,
        message: `Kupon '${kodeClean}' belum mulai berlaku (mulai: ${diskon.tanggal_awal.toISOString().split('T')[0]})`,
      };
    }

    if (dateToCheck > diskon.tanggal_akhir) {
      return {
        is_valid: false,
        message: `Kupon '${kodeClean}' telah kedaluwarsa pada ${diskon.tanggal_akhir.toISOString().split('T')[0]}`,
      };
    }

    let subtotal = dto.subtotal || 0;
    let potongan = (subtotal * diskon.presentase_diskon) / 100;
    let total_bayar = Math.max(0, subtotal - potongan);

    return {
      is_valid: true,
      valid: true,
      id_diskon: diskon.id,
      kode_diskon: diskon.kode_diskon,
      nama_diskon: diskon.nama_diskkon,
      presentase_diskon: diskon.presentase_diskon,
      subtotal,
      potongan,
      total_setelah_diskon: total_bayar,
      diskon: {
        id: diskon.id,
        kode_diskon: diskon.kode_diskon,
        nama_diskkon: diskon.nama_diskkon,
        presentase_diskon: diskon.presentase_diskon,
        tanggal_awal: diskon.tanggal_awal,
        tanggal_akhir: diskon.tanggal_akhir,
        id_owner: diskon.id_owner,
      },
      message: `Kupon '${kodeClean}' aktif! Potongan ${diskon.presentase_diskon}% berhasil diterapkan.`,
    };
  }
}
