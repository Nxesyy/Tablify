import { Injectable, Logger } from '@nestjs/common';

export interface NotificationPayload {
  to: {
    userId?: number;
    username?: string | null;
    telp?: string;
    nama: string;
  };
  title: string;
  message: string;
  type: 'UPCOMING_RESERVATION' | 'SESSION_ENDING';
  metadata?: Record<string, any>;
}

@Injectable()
export class ReminderNotificationService {
  private readonly logger = new Logger(ReminderNotificationService.name);

  /**
   * Dispatcher notifikasi modular (bisa disambungkan ke Nodemailer, WhatsApp Gateway, Webhook, atau FCM)
   */
  async dispatch(payload: NotificationPayload): Promise<boolean> {
    this.logger.log(
      `[TRIGGER NOTIFIKASI - ${payload.type}] Mengirim ke ${payload.to.nama} (${payload.to.telp || payload.to.username || 'User'}): "${payload.title}" - ${payload.message}`,
    );

    // Mock dispatch / integration hook:
    // await this.waGateway.send({ phone: payload.to.telp, text: payload.message });

    return true;
  }

  /**
   * Pengingat H-1 Jam sebelum waktu mulai
   */
  async notifyUpcomingBooking(reservasi: any) {
    const memberName = reservasi.member?.nama_member ?? 'Pelanggan';
    const spaceName = reservasi.detailReservasi?.space?.nama_space ?? 'Meja Reservasi';
    const coworkingName = reservasi.space_owner?.nama_coworking ?? 'Coworking Space';
    const jamMulai = new Date(reservasi.jam_mulai).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.dispatch({
      to: {
        userId: reservasi.member?.id_user,
        username: reservasi.member?.user?.username,
        telp: reservasi.member?.telp,
        nama: memberName,
      },
      title: `Pengingat Reservasi Meja di ${coworkingName}`,
      message: `Halo ${memberName}, reservasi meja Anda (${spaceName}) di ${coworkingName} akan dimulai dalam 1 jam (pukul ${jamMulai}). Siapkan tiket Anda untuk proses check-in cepat di resepsionis.`,
      type: 'UPCOMING_RESERVATION',
      metadata: {
        id_reservasi: reservasi.id,
        kode_tiket: reservasi.kode_tiket,
      },
    });
  }

  /**
   * Pengingat Sesi Sewa Tinggal 15 Menit Lagi
   */
  async notifySessionEnding(reservasi: any) {
    const memberName = reservasi.member?.nama_member ?? 'Pelanggan';
    const spaceName = reservasi.detailReservasi?.space?.nama_space ?? 'Meja';
    const jamSelesai = reservasi.jam_selesai
      ? new Date(reservasi.jam_selesai).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'segera';

    return this.dispatch({
      to: {
        userId: reservasi.member?.id_user,
        username: reservasi.member?.user?.username,
        telp: reservasi.member?.telp,
        nama: memberName,
      },
      title: `Waktu Sewa Segera Berakhir (15 Menit Tersisa)`,
      message: `Halo ${memberName}, masa sewa meja ${spaceName} Anda akan berakhir pada pukul ${jamSelesai}. Jika membutuhkan tambahan waktu, Anda dapat memperpanjang durasi melalui menu Extend Booking sebelum jam sewa habis.`,
      type: 'SESSION_ENDING',
      metadata: {
        id_reservasi: reservasi.id,
        kode_tiket: reservasi.kode_tiket,
      },
    });
  }
}

