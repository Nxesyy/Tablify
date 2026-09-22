import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { EventsService } from '../events/events.service.js';
import { Xendit } from 'xendit-node';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private secretKey: string;
  private webhookToken: string;
  private xenditClient: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {
    this.secretKey =
      this.configService.get<string>('XENDIT_SECRET_KEY') ||
      process.env.XENDIT_SECRET_KEY ||
      '';
    this.webhookToken =
      this.configService.get<string>('XENDIT_WEBHOOK_VERIFICATION_TOKEN') ||
      process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN ||
      '';

    this.initXenditClient();
  }

  onModuleInit() {
    this.auditEnvironment();
  }

  private maskKey(key: string, visiblePrefix = 6, visibleSuffix = 4): string {
    if (!key) return '(tidak terpasang / undefined)';
    if (key.length <= visiblePrefix + visibleSuffix) {
      return key.slice(0, 3) + '***';
    }
    return `${key.slice(0, visiblePrefix)}...${key.slice(-visibleSuffix)}`;
  }

  private auditEnvironment() {
    this.logger.log('================ [XENDIT INTEGRATION AUDIT] ================');

    // 1. Audit XENDIT_SECRET_KEY
    if (!this.secretKey || this.secretKey.trim() === '') {
      this.logger.error(
        '❌ PERINGATAN: XENDIT_SECRET_KEY bernilai undefined atau kosong di file .env! Transaksi online tidak akan dapat diproses.',
      );
    } else {
      const masked = this.maskKey(this.secretKey, 8, 4);
      this.logger.log(`🔑 XENDIT_SECRET_KEY terbaca: ${masked}`);

      // 3. Deteksi Lingkungan (Sandbox vs Production)
      if (this.secretKey.startsWith('xnd_development_')) {
        this.logger.log('🧪 Mode: XENDIT SANDBOX (Pastikan Dashboard Xendit disetel ke Test Mode)');
      } else if (this.secretKey.startsWith('xnd_production_')) {
        this.logger.log('🚀 Mode: XENDIT PRODUCTION (Live Environment)');
      } else {
        this.logger.warn(`⚠️ Mode: Prefix key tidak standar ("${this.secretKey.slice(0, 4)}...").`);
      }
    }

    // Audit XENDIT_WEBHOOK_VERIFICATION_TOKEN
    if (!this.webhookToken || this.webhookToken.trim() === '') {
      this.logger.warn(
        '⚠️ PERINGATAN: XENDIT_WEBHOOK_VERIFICATION_TOKEN bernilai undefined atau kosong di .env. Verifikasi webhook akan ditolak.',
      );
    } else {
      const maskedToken = this.maskKey(this.webhookToken, 6, 4);
      this.logger.log(`🛡️ Webhook Verification Token terbaca: ${maskedToken}`);
    }
    this.logger.log('============================================================');
  }

  private initXenditClient() {
    try {
      if (this.secretKey) {
        this.xenditClient = new Xendit({ secretKey: this.secretKey });
      }
    } catch (err: any) {
      this.logger.warn(`Xendit SDK init notice: ${err.message}.`);
      this.xenditClient = { opts: { secretKey: this.secretKey } };
    }
  }

  /**
   * Endpoint Diagnosa & Uji Koneksi Xendit API
   */
  async testConnection() {
    const isConfigured = Boolean(
      this.secretKey && this.secretKey.trim() !== '',
    );

    if (!isConfigured) {
      return {
        success: false,
        status: 'CONFIG_ERROR',
        message: 'XENDIT_SECRET_KEY belum dipasang atau kosong di file .env backend.',
        recommendation:
          'Tambahkan XENDIT_SECRET_KEY=xnd_development_... pada file back-e/.env lalu restart server backend.',
      };
    }

    const mode = this.secretKey.startsWith('xnd_development_')
      ? 'SANDBOX (TEST MODE)'
      : this.secretKey.startsWith('xnd_production_')
      ? 'PRODUCTION (LIVE MODE)'
      : 'UNKNOWN';

    const maskedKey = this.maskKey(this.secretKey, 8, 4);

    try {
      // 1. Uji koneksi ringan ke API Xendit (Balance API)
      const authHeader = 'Basic ' + Buffer.from(`${this.secretKey}:`).toString('base64');
      const balanceRes = await fetch('https://api.xendit.co/balance?account_type=CASH', {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      const balanceData = await balanceRes.json();

      if (!balanceRes.ok) {
        this.logger.error(
          `❌ Xendit API Connection Test GAGAL (${balanceRes.status}): ${JSON.stringify(balanceData)}`,
        );

        let hint = 'Periksa status API Key di Dashboard Xendit.';
        if (balanceRes.status === 401) {
          hint =
            'API Key salah atau tidak valid (401 Unauthorized / INVALID_API_KEY). Pastikan Anda menyalin Secret Key yang benar dari menu Settings > API Keys.';
        } else if (balanceRes.status === 403) {
          hint =
            'API Key tidak memiliki izin (403 Forbidden). Buka Dashboard Xendit > Settings > API Keys, edit key Anda, dan aktifkan perizinan yang dibutuhkan.';
        }

        return {
          success: false,
          status: balanceRes.status,
          errorCode: balanceData.error_code || 'API_ERROR',
          message: balanceData.message || 'Gagal terhubung ke API Xendit',
          mode,
          maskedKey,
          recommendation: hint,
        };
      }

      // 2. Uji Write Permission untuk QR Code (Dry Check)
      let qrPermission = 'ACTIVE';
      try {
        const qrTest = await fetch('https://api.xendit.co/qr_codes', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            'api-version': '2022-07-31',
          },
          body: JSON.stringify({
            reference_id: `DRY-TEST-${Date.now()}`,
            type: 'DYNAMIC',
            currency: 'IDR',
            amount: 1000,
          }),
        });
        const qrJson = await qrTest.json();
        if (qrTest.status === 403) {
          qrPermission = 'FORBIDDEN (API Key tidak memiliki izin Write QR Code)';
        } else if (qrTest.ok) {
          qrPermission = 'READY (Write Permission Aktif)';
        } else {
          qrPermission = `HTTP_${qrTest.status} (${qrJson.error_code || qrJson.message})`;
        }
      } catch (e: any) {
        qrPermission = `CHECK_FAILED: ${e.message}`;
      }

      // 3. Uji Write Permission untuk Virtual Account (Dry Check)
      let vaPermission = 'ACTIVE';
      try {
        const vaTest = await fetch('https://api.xendit.co/callback_virtual_accounts', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            external_id: `DRY-TEST-VA-${Date.now()}`,
            bank_code: 'BCA',
            name: 'TABLIFY TEST',
            is_closed: true,
            expected_amount: 10000,
            expiration_date: new Date(Date.now() + 86400000).toISOString(),
          }),
        });
        const vaJson = await vaTest.json();
        if (vaTest.status === 403) {
          vaPermission = 'FORBIDDEN (API Key tidak memiliki izin Write Virtual Account)';
        } else if (vaTest.ok) {
          vaPermission = 'READY (Write Permission Aktif)';
        } else {
          vaPermission = `HTTP_${vaTest.status} (${vaJson.error_code || vaJson.message})`;
        }
      } catch (e: any) {
        vaPermission = `CHECK_FAILED: ${e.message}`;
      }

      this.logger.log(
        `✅ Xendit API Connection Test BERHASIL. Mode: ${mode}, Saldo: Rp ${balanceData.balance?.toLocaleString('id-ID') || 0}`,
      );

      const hasPermissionWarning =
        qrPermission.includes('FORBIDDEN') || vaPermission.includes('FORBIDDEN');

      return {
        success: true,
        message: hasPermissionWarning
          ? 'Koneksi ke Xendit berhasil (terautentikasi), namun API Key memerlukan izin tambahan (Write) di Dashboard Xendit.'
          : 'Koneksi ke Xendit API sepenuhnya berhasil dan siap memproses transaksi.',
        mode,
        maskedKey,
        webhookTokenConfigured: Boolean(this.webhookToken),
        maskedWebhookToken: this.maskKey(this.webhookToken, 6, 4),
        diagnostics: {
          balance: balanceData.balance,
          currency: 'IDR',
          authStatus: '200 OK (Authenticated)',
          qrCodeWritePermission: qrPermission,
          virtualAccountWritePermission: vaPermission,
        },
        actionRequired: hasPermissionWarning
          ? 'Buka Dashboard Xendit > Settings > API Keys, edit key Anda, centang izin "Write" untuk QR Codes & Virtual Accounts (pada bagian Money-in), lalu Simpan.'
          : 'Tidak ada tindakan diperlukan. Semua perizinan API Key lengkap.',
      };
    } catch (networkErr: any) {
      this.logger.error(`❌ Network Timeout / Connection Error ke Xendit: ${networkErr.message}`);
      return {
        success: false,
        status: 'NETWORK_TIMEOUT',
        message: `Gagal menghubungi API Xendit: ${networkErr.message}`,
        mode,
        maskedKey,
        recommendation: 'Periksa koneksi internet atau firewall server Anda.',
      };
    }
  }

  /**
   * 1. Buat pembayaran QRIS Dinamis via Xendit
   */
  async createQrisPayment(reservationId: number, amount: number) {
    const reservation = await this.prisma.reservasi.findUnique({
      where: { id: reservationId },
      include: {
        space_owner: true,
        detailReservasi: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservasi dengan ID ${reservationId} tidak ditemukan.`);
    }

    const externalID = `RES-${reservationId}-${Date.now()}`;
    const cleanAmount = Math.round(amount);

    const isRealKey =
      this.secretKey &&
      this.secretKey.startsWith('xnd_') &&
      !this.secretKey.includes('tablify_secret_key');

    if (isRealKey) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${this.secretKey}:`).toString('base64');
        const res = await fetch('https://api.xendit.co/qr_codes', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            'api-version': '2022-07-31',
          },
          body: JSON.stringify({
            reference_id: externalID,
            type: 'DYNAMIC',
            currency: 'IDR',
            amount: cleanAmount,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          this.logger.log(
            `✅ QRIS Dinamis Xendit Berhasil Dibuat: ID=${data.id}, ExternalID=${externalID}, Amount=${cleanAmount}`,
          );
          return {
            qrId: data.id,
            qrString: data.qr_string,
            status: data.status || 'ACTIVE',
            externalId: externalID,
            referenceId: externalID,
            amount: cleanAmount,
            expiresAt: data.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          };
        }

        this.logger.error(
          `❌ Gagal membuat QRIS di Xendit (HTTP ${res.status}): ${JSON.stringify(data)}`,
        );

        if (res.status === 403) {
          throw new BadRequestException(
            `Xendit 403 Forbidden: API Key Anda tidak memiliki izin 'Write' untuk QR Code di Dashboard Xendit. Buka Dashboard Xendit > Settings > API Keys dan centang izin Write QR Codes. Detail: ${data.message || data.error_code}`,
          );
        }

        if (res.status === 401) {
          throw new BadRequestException(
            `Xendit 401 Unauthorized: API Key tidak valid. Periksa kembali XENDIT_SECRET_KEY di file .env.`,
          );
        }

        throw new BadRequestException(
          `Xendit QRIS Error: ${data.message || data.error_code || 'Gagal membuat QRIS'}`,
        );
      } catch (err: any) {
        if (err instanceof BadRequestException || err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error(`❌ Network error saat memanggil Xendit QRIS: ${err.message}`);
        throw new BadRequestException(`Koneksi ke gateway pembayaran Xendit gagal: ${err.message}`);
      }
    }

    // Fallback jika API key belum dipasang
    this.logger.warn('⚠️ Menggunakan Dummy QRIS Simulator karena XENDIT_SECRET_KEY belum dikonfigurasi di .env.');
    const qrId = `qr_sim_${Date.now()}_${externalID}`;
    const amountStr = String(cleanAmount);
    const qrString = `00020101021226580014ID.LINKAJA.WWW01189360099900000000010215${externalID}51440014ID.CO.QRIS.WWW0215ID10200000000000303UME520458125303360540${amountStr.length}${amountStr}5802ID5913TABLIFY COWORK6007JAKARTA62070703A016304`;

    return {
      qrId,
      qrString,
      status: 'ACTIVE',
      externalId: externalID,
      referenceId: externalID,
      amount: cleanAmount,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  /**
   * 2. Buat Virtual Account Tertutup (Closed Fixed VA) via Xendit
   */
  async createVirtualAccount(
    reservationId: number,
    bankCode: string,
    customerName: string = 'PELANGGAN TABLIFY',
    amount: number,
  ) {
    const reservation = await this.prisma.reservasi.findUnique({
      where: { id: reservationId },
      include: {
        member: true,
        detailReservasi: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservasi dengan ID ${reservationId} tidak ditemukan.`);
    }

    const name = customerName || reservation.member?.nama_member || 'MEMBER TABLIFY';
    const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Jam
    const externalID = `RES-VA-${reservationId}-${bankCode.toUpperCase()}-${Date.now()}`;
    const cleanAmount = Math.round(amount);

    const isRealKey =
      this.secretKey &&
      this.secretKey.startsWith('xnd_') &&
      !this.secretKey.includes('tablify_secret_key');

    if (isRealKey) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${this.secretKey}:`).toString('base64');
        const res = await fetch('https://api.xendit.co/callback_virtual_accounts', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            external_id: externalID,
            bank_code: bankCode.toUpperCase(),
            name: name.slice(0, 30).toUpperCase(),
            is_closed: true,
            expected_amount: cleanAmount,
            expiration_date: expirationDate.toISOString(),
          }),
        });

        const data = await res.json();

        if (res.ok) {
          this.logger.log(
            `✅ Virtual Account ${bankCode.toUpperCase()} Xendit Berhasil Dibuat: Account=${data.account_number}, ExternalID=${externalID}`,
          );
          return {
            accountNumber: data.account_number,
            bankCode: data.bank_code || bankCode.toUpperCase(),
            merchantCode: data.merchant_code || 'TABLIFY',
            expirationDate: data.expiration_date || expirationDate.toISOString(),
            customerName: name,
            amount: cleanAmount,
          };
        }

        this.logger.error(
          `❌ Gagal membuat VA di Xendit (HTTP ${res.status}): ${JSON.stringify(data)}`,
        );

        if (res.status === 403) {
          throw new BadRequestException(
            `Xendit 403 Forbidden: API Key Anda tidak memiliki izin 'Write' untuk Virtual Account di Dashboard Xendit. Buka Dashboard Xendit > Settings > API Keys dan centang izin Write Virtual Accounts. Detail: ${data.message || data.error_code}`,
          );
        }

        if (res.status === 401) {
          throw new BadRequestException(
            `Xendit 401 Unauthorized: API Key tidak valid. Periksa kembali XENDIT_SECRET_KEY di file .env.`,
          );
        }

        throw new BadRequestException(
          `Xendit VA Error: ${data.message || data.error_code || 'Gagal membuat Virtual Account'}`,
        );
      } catch (err: any) {
        if (err instanceof BadRequestException || err instanceof NotFoundException) {
          throw err;
        }
        this.logger.error(`❌ Network error saat memanggil Xendit VA: ${err.message}`);
        throw new BadRequestException(`Koneksi ke gateway pembayaran Xendit gagal: ${err.message}`);
      }
    }

    // Fallback jika API key belum dipasang
    this.logger.warn('⚠️ Menggunakan Dummy VA Simulator karena XENDIT_SECRET_KEY belum dikonfigurasi di .env.');
    const bankPrefixes: Record<string, string> = {
      BCA: '8808',
      BNI: '8818',
      BRI: '8828',
      MANDIRI: '8908',
      PERMATA: '8708',
      CIMB: '8608',
    };
    const prefix = bankPrefixes[bankCode.toUpperCase()] || '8808';
    const cleanId = String(externalID).replace(/\D/g, '').slice(-4);
    const randomPad = Math.floor(1000 + Math.random() * 9000);
    const accountNumber = `${prefix}${cleanId || '1024'}${randomPad}`;

    return {
      accountNumber,
      bankCode: bankCode.toUpperCase(),
      merchantCode: 'TABLIFY',
      expirationDate: expirationDate.toISOString(),
      customerName: name,
      amount: cleanAmount,
    };
  }

  /**
   * 3. Handle Webhook Notifikasi Real-Time dari Xendit
   */
  async handleWebhook(callbackToken: string, payload: any) {
    this.logger.log('🔔 [WEBHOOK INCOMING] Memproses request callback dari Xendit...');

    // 4. Audit & Validasi Webhook Token
    const receivedToken = (callbackToken || '').trim();
    const expectedToken = (this.webhookToken || '').trim();

    const isTokenMatch =
      Boolean(receivedToken) &&
      Boolean(expectedToken) &&
      receivedToken === expectedToken;

    if (!isTokenMatch) {
      const maskedReceived = this.maskKey(receivedToken, 6, 4);
      const maskedExpected = this.maskKey(expectedToken, 6, 4);

      this.logger.warn(
        `❌ Webhook DITOLAK: Header 'x-callback-token' tidak cocok!\n` +
          `   - Diterima dari header : ${maskedReceived} (panjang: ${receivedToken.length})\n` +
          `   - Diharapkan dari .env  : ${maskedExpected} (panjang: ${expectedToken.length})`,
      );
      throw new UnauthorizedException('Token verifikasi webhook tidak valid.');
    }

    this.logger.log('✅ Webhook Callback Token Terverifikasi Valid.');
    this.logger.log(`📦 Webhook Payload: ${JSON.stringify(payload)}`);

    try {
      const isQrisSuccess = payload.status === 'COMPLETED' || payload.data?.status === 'COMPLETED';
      const isVaSuccess =
        payload.event === 'virtual_account.paid' ||
        payload.status === 'PAID' ||
        (payload.payment_id && payload.account_number);

      if (isQrisSuccess || isVaSuccess) {
        const rawExternalId =
          payload.reference_id ||
          payload.external_id ||
          payload.data?.reference_id ||
          payload.data?.external_id ||
          payload.qr_code?.reference_id ||
          payload.qr_code?.external_id ||
          '';

        const matches = rawExternalId.match(/RES(?:-VA)?-(\d+)/);
        const reservationId = matches ? Number(matches[1]) : null;

        if (reservationId) {
          const updatedReservation = await this.prisma.reservasi.update({
            where: { id: reservationId },
            data: {
              status: 'Disetujui',
            },
            include: {
              member: true,
              space_owner: true,
              detailReservasi: true,
            },
          });

          this.logger.log(
            `🎉 Pembayaran SUKSES untuk Reservasi ID #${reservationId}. Status berhasil diubah menjadi 'Disetujui'.`,
          );

          this.eventsService.emit('RESERVATION_STATUS_CHANGED', {
            id_reservasi: updatedReservation.id,
            kode_tiket: updatedReservation.kode_tiket,
            status: updatedReservation.status,
            id_owner: updatedReservation.id_owner,
            metode: isQrisSuccess ? 'QRIS' : 'VIRTUAL_ACCOUNT',
            nama_member: updatedReservation.member?.nama_member,
          });

          return { received: true, status: 'PROCESSED', id_reservasi: reservationId };
        }
      }

      return { received: true, status: 'ACKNOWLEDGED' };
    } catch (dbError: any) {
      this.logger.error(`❌ Gagal memproses data webhook ke database: ${dbError.message}`);
      return { received: true, status: 'ERROR', error: dbError.message };
    }
  }

  /**
   * 4. Cek Status Pembayaran Reservasi (Untuk Auto-Polling Frontend)
   */
  async getPaymentStatus(reservationId: number) {
    const reservation = await this.prisma.reservasi.findUnique({
      where: { id: reservationId },
      include: {
        detailReservasi: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservasi #${reservationId} tidak ditemukan.`);
    }

    const isPaid =
      reservation.status === 'Disetujui' ||
      reservation.status === 'aktif' ||
      reservation.status === 'selesai';

    return {
      id_reservasi: reservation.id,
      kode_tiket: reservation.kode_tiket,
      status: reservation.status,
      isPaid,
      total_harga: reservation.detailReservasi?.total_harga || 0,
      updatedAt: reservation.updatedAt,
    };
  }
}
