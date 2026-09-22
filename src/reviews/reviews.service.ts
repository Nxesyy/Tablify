import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mengirim ulasan dan rating fasilitas dari tiket reservasi yang selesai
   */
  async createReview(dto: CreateReviewDto, userId: number) {
    const member = await this.prisma.member.findUnique({
      where: { id_user: userId },
    });

    if (!member) {
      throw new ForbiddenException('Hanya akun member yang berhak memberikan ulasan');
    }

    const reservasi = await this.prisma.reservasi.findUnique({
      where: { id: dto.id_reservasi },
      include: {
        detailReservasi: true,
        review: true,
      },
    });

    if (!reservasi) {
      throw new NotFoundException('Data tiket reservasi tidak ditemukan');
    }

    if (reservasi.id_member !== member.id) {
      throw new ForbiddenException('Anda tidak berhak memberi ulasan untuk tiket milik orang lain');
    }

    // Validasi: Status harus 'aktif' (sedang digunakan), 'selesai', atau 'Disetujui'
    const allowedStatuses = ['aktif', 'selesai', 'Disetujui'];
    if (!allowedStatuses.includes(reservasi.status)) {
      throw new BadRequestException(
        `Ulasan hanya dapat dikirimkan jika meja telah melalui pembayaran dan sedang digunakan ('aktif') atau telah 'selesai'. Status saat ini: '${reservasi.status}'`,
      );
    }

    // Validasi 1 review per 1 tiket reservasi
    if (reservasi.review) {
      throw new BadRequestException('Tiket reservasi ini sudah pernah Anda beri ulasan');
    }

    const spaceId = reservasi.detailReservasi?.id_space;
    if (!spaceId) {
      throw new BadRequestException('Data space pada tiket reservasi ini tidak valid');
    }

    const newReview = await this.prisma.review.create({
      data: {
        id_space: spaceId,
        id_member: member.id,
        id_reservasi: reservasi.id,
        rating: dto.rating,
        komentar: dto.komentar.trim(),
      },
      include: {
        member: {
          select: { nama_member: true, foto: true },
        },
        space: {
          select: { nama_space: true },
        },
      },
    });

    return {
      success: true,
      message: 'Terima kasih, ulasan dan penilaian fasilitas Anda berhasil disimpan',
      data: newReview,
    };
  }

  /**
   * Mengambil daftar ulasan dan kalkulasi agregasi rating per space
   */
  async getSpaceReviews(spaceId: number) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        owner: {
          select: { nama_coworking: true },
        },
      },
    });

    if (!space) {
      throw new NotFoundException('Data meja/ruangan tidak ditemukan');
    }

    // Agregasi nilai rata-rata dan total ulasan
    const agg = await this.prisma.review.aggregate({
      where: { id_space: spaceId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Distribusi rating bintang 1 - 5
    const allRatings = await this.prisma.review.findMany({
      where: { id_space: spaceId },
      select: { rating: true },
    });

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allRatings.forEach((r) => {
      if (breakdown[r.rating] !== undefined) {
        breakdown[r.rating]++;
      }
    });

    // Daftar ulasan terbaru
    const reviews = await this.prisma.review.findMany({
      where: { id_space: spaceId },
      include: {
        member: {
          select: {
            id: true,
            nama_member: true,
            foto: true,
            Instansi: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        space_id: space.id,
        nama_space: space.nama_space,
        nama_coworking: space.owner.nama_coworking,
        rating_rata_rata: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
        total_ulasan: agg._count.rating || 0,
        distribusi_bintang: breakdown,
        ulasan: reviews,
      },
    };
  }

  /**
   * Mengambil semua riwayat ulasan yang pernah dikirim oleh member yang sedang login
   */
  async getMyReviews(userId: number) {
    const member = await this.prisma.member.findUnique({
      where: { id_user: userId },
    });

    if (!member) {
      throw new ForbiddenException('Hanya akun member yang memiliki riwayat ulasan');
    }

    const reviews = await this.prisma.review.findMany({
      where: { id_member: member.id },
      include: {
        space: {
          include: {
            owner: {
              select: {
                id: true,
                nama_coworking: true,
                alamat: true,
              },
            },
          },
        },
        reservasi: {
          select: {
            id: true,
            kode_tiket: true,
            tanggal_reservasi: true,
            jam_mulai: true,
            jam_selesai: true,
            durasi_jam: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      total: reviews.length,
      data: reviews,
    };
  }

  private async getOwnerIdByUserId(userId: number): Promise<number> {
    const owner = await this.prisma.space_owner.findUnique({
      where: { id_user: userId },
    });
    if (!owner) {
      throw new ForbiddenException('Akses ditolak. Anda bukan Admin Gerai/Owner');
    }
    return owner.id;
  }

  /**
   * Mengambil semua ulasan pelanggan untuk meja-meja milik gerai admin yang sedang login
   */
  async getOwnerReviews(
    userId: number,
    query?: { space_id?: number; rating?: number; search?: string },
  ) {
    const id_owner = await this.getOwnerIdByUserId(userId);

    const whereClause: any = {
      space: {
        id_owner,
      },
    };

    if (query?.space_id) {
      whereClause.id_space = Number(query.space_id);
    }

    if (query?.rating) {
      whereClause.rating = Number(query.rating);
    }

    if (query?.search) {
      whereClause.OR = [
        { komentar: { contains: query.search, mode: 'insensitive' } },
        { member: { nama_member: { contains: query.search, mode: 'insensitive' } } },
        { space: { nama_space: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    // Ambil agregasi statistik gerai
    const agg = await this.prisma.review.aggregate({
      where: {
        space: { id_owner },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Distribusi rating bintang 1 - 5
    const allRatings = await this.prisma.review.findMany({
      where: {
        space: { id_owner },
      },
      select: { rating: true },
    });

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allRatings.forEach((r) => {
      if (breakdown[r.rating] !== undefined) {
        breakdown[r.rating]++;
      }
    });

    const reviews = await this.prisma.review.findMany({
      where: whereClause,
      include: {
        member: {
          select: {
            id: true,
            nama_member: true,
            foto: true,
            telp: true,
            Instansi: true,
          },
        },
        space: {
          select: {
            id: true,
            nama_space: true,
            tipe: true,
            harga_per_jam: true,
          },
        },
        reservasi: {
          select: {
            id: true,
            kode_tiket: true,
            tanggal_reservasi: true,
            jam_mulai: true,
            jam_selesai: true,
            durasi_jam: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      summary: {
        rating_rata_rata: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
        total_ulasan: agg._count.rating || 0,
        distribusi_bintang: breakdown,
      },
      total: reviews.length,
      data: reviews,
    };
  }
}
