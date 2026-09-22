import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}


  getApiInfo() {
    return {
      name: 'Tablify API - Coworking Space & Cafe Reservation Platform',
      version: '1.0.0',
      status: 'online',
      server_time: new Date().toISOString(),
      description:
        'API backend platform pemesanan meja kafe dan coworking space multi-tenant dengan sistem anti double-booking, diskon promo, tiket QR, dan analitik finansial.',
      daftar_endpoint: {
        system_status: {
          'GET /': 'Status API dan dokumentasi umum endpoint',
          'GET /health': 'Pemeriksaan status kesehatan server, memori, uptime, dan koneksi database',
        },
        auth_pengguna: {
          'POST /auth/register': 'Pendaftaran akun Member (nama, kontak, instansi, alamat, foto)',
          'POST /auth/register-admin': 'Pendaftaran akun Admin Space Owner (nama coworking/kafe, pemilik, telp)',
          'POST /auth/login': 'Login pengguna via username',
          'GET /auth/profile': 'Melihat profil akun pengguna yang sedang login',
          'PUT /auth/profile': 'Memperbarui profil akun pengguna yang sedang login',
        },
        manajemen_spaces: {
          'GET /spaces': 'Melihat katalog meja/ruang (support filter: id_owner, tipe, kapasitas)',
          'GET /spaces/my-spaces': 'Melihat daftar space milik gerai admin yang login (Admin Space)',
          'GET /spaces/:id': 'Melihat detail meja/ruang',
          'POST /spaces': 'Menambahkan meja/ruang baru (Admin Space)',
          'PATCH /spaces/:id': 'Memperbarui data meja/ruang (Admin Space)',
          'DELETE /spaces/:id': 'Menghapus meja/ruang (Admin Space)',
          'GET /spaces/:id/availability': 'Cek ketersediaan meja real-time (anti double-booking)',
        },
        diskon_promo: {
          'GET /diskon': 'Melihat daftar promo aktif milik gerai admin atau filter per gerai',
          'GET /diskon/:id': 'Melihat detail kupon promo',
          'POST /diskon': 'Membuat kupon promo baru (Admin Space)',
          'PATCH /diskon/:id': 'Memperbarui kupon promo (Admin Space)',
          'DELETE /diskon/:id': 'Menghapus kupon promo (Admin Space)',
          'POST /diskon/validate': 'Validasi otomatis kode kupon saat checkout',
        },
        transaksi_reservasi: {
          'POST /reservasi': 'Checkout reservasi baru (dengan kalkulasi otomatis & anti-overlap)',
          'GET /reservasi/my-history': 'Riwayat reservasi member (filter: bulan, tahun, status)',
          'GET /reservasi/owner-reservations': 'Daftar reservasi masuk gerai admin (filter: bulan, tahun, status)',
          'GET /reservasi/:id': 'Detail reservasi',
          'GET /reservasi/ticket/:kodeTiket': 'Mengambil e-tiket digital lengkap dengan payload QR Code',
          'PATCH /reservasi/:id/cancel': 'Pembatalan mandiri reservasi oleh member',
          'PATCH /reservasi/:id/status': 'Update status alur reservasi (Admin Space)',
          'POST /reservasi/check-in': 'Fast check-in tamu di resepsionis via kode tiket / ID',
          'POST /reservasi/check-out': 'Fast check-out tamu di resepsionis via kode tiket / ID',
          'GET /reservasi/verify/:kodeTiket': 'Verifikasi cepat validitas tiket di resepsionis',
        },
        admin_laporan: {
          'GET /admin/reports/financial': 'Rekapitulasi finansial bulanan (omzet kotor, diskon, omzet bersih, total jam)',
          'GET /admin/reports/occupancy': 'Analitik okupansi (ruangan terpopuler & jam tersibuk)',
          'GET /admin/member': 'Daftar semua member terdaftar',
        },
      },
    };
  }

  async getHealth() {
    let dbStatus = 'connected';
    let dbLatencyMs: number | null = null;

    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch (error) {
      dbStatus = `disconnected: ${(error as Error).message}`;
    }

    const memoryUsage = process.memoryUsage();

    return {
      status: dbStatus.startsWith('connected') ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatencyMs,
        },
        api_server: {
          status: 'online',
          node_version: process.version,
        },
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heap_used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heap_total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      },
    };
  }
}
