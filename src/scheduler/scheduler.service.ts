import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReminderNotificationService } from './reminder-notification.service.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  // Set memory cache untuk melacak ID reservasi yang sudah diberi reminder agar tidak duplikat
  private notifiedUpcomingIds = new Set<number>();
  private notifiedEndingIds = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderService: ReminderNotificationService,
  ) {}

  /**
   * SMART REMINDER & NOTIFIKASI
   * Dijalankan setiap 5 menit.
   * - Mendeteksi reservasi yang akan mulai dalam 1 jam ke depan (50-65 menit).
   * - Mendeteksi sesi aktif yang tersisa 15 menit sebelum waktu selesai (10-20 menit).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSmartReminders() {
    this.logger.log('Menjalankan cron worker: Pengecekan Smart Reminders...');

    const now = new Date();

    // A. Pengingat H-1 Jam sebelum mulai (range 50 - 65 menit dari sekarang)
    const upcomingStart = new Date(now.getTime() + 50 * 60 * 1000);
    const upcomingEnd = new Date(now.getTime() + 65 * 60 * 1000);

    try {
      const upcomingReservations = await this.prisma.reservasi.findMany({
        where: {
          status: 'Disetujui',
          jam_mulai: {
            gte: upcomingStart,
            lte: upcomingEnd,
          },
        },
        include: {
          member: {
            include: {
              user: { select: { username: true } },
            },
          },
          detailReservasi: {
            include: { space: true },
          },
          space_owner: true,
        },
      });

      for (const res of upcomingReservations) {
        if (!this.notifiedUpcomingIds.has(res.id)) {
          await this.reminderService.notifyUpcomingBooking(res);
          this.notifiedUpcomingIds.add(res.id);
        }
      }
    } catch (error) {
      this.logger.error('Gagal memproses upcoming reminder', error);
    }

    // B. Pengingat Sesi Aktif Tinggal 15 Menit Lagi (range 10 - 20 menit sebelum jam_selesai)
    const endingStart = new Date(now.getTime() + 10 * 60 * 1000);
    const endingEnd = new Date(now.getTime() + 20 * 60 * 1000);

    try {
      const endingReservations = await this.prisma.reservasi.findMany({
        where: {
          status: 'aktif',
          jam_selesai: {
            gte: endingStart,
            lte: endingEnd,
          },
        },
        include: {
          member: {
            include: {
              user: { select: { username: true } },
            },
          },
          detailReservasi: {
            include: { space: true },
          },
          space_owner: true,
        },
      });

      for (const res of endingReservations) {
        if (!this.notifiedEndingIds.has(res.id)) {
          await this.reminderService.notifySessionEnding(res);
          this.notifiedEndingIds.add(res.id);
        }
      }
    } catch (error) {
      this.logger.error('Gagal memproses session ending reminder', error);
    }

    // Bersihkan cache memori jika ukurannya melebihi 2000 entri
    if (this.notifiedUpcomingIds.size > 2000) this.notifiedUpcomingIds.clear();
    if (this.notifiedEndingIds.size > 2000) this.notifiedEndingIds.clear();
  }

  /**
   * AUTO-CANCEL RESERVASI KEDALUWARSA / ABANDONED CHECKOUT
   * Dijalankan setiap 5 menit.
   * - Membatalkan reservasi berstatus 'Belum_Dikonfirmasi' yang dibuat > 30 menit lalu
   *   atau yang jam_mulai-nya sudah terlewati, sehingga meja otomatis bebas kembali (unlocked).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoCancelExpiredBookings() {
    this.logger.log('Menjalankan cron worker: Auto-cancel reservasi kedaluwarsa...');
    const now = new Date();
    const thresholdCreatedAt = new Date(now.getTime() - 30 * 60 * 1000); // 30 Menit lalu

    try {
      const expiredList = await this.prisma.reservasi.findMany({
        where: {
          status: 'Belum_Dikonfirmasi',
          OR: [
            { createdAt: { lt: thresholdCreatedAt } },
            { jam_mulai: { lt: now } },
          ],
        },
        select: {
          id: true,
          kode_tiket: true,
          id_owner: true,
        },
      });

      if (expiredList.length > 0) {
        const idsToCancel = expiredList.map((r) => r.id);
        const result = await this.prisma.reservasi.updateMany({
          where: {
            id: { in: idsToCancel },
          },
          data: {
            status: 'dibatalkan',
          },
        });

        this.logger.warn(
          `[Anti-Locked Table] Berhasil membatalkan ${result.count} reservasi kadaluwarsa: [${idsToCancel.join(', ')}]`,
        );
      }
    } catch (error) {
      this.logger.error('Gagal menjalankan auto-cancel reservasi kadaluwarsa', error);
    }
  }
}

