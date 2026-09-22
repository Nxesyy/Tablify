import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import { CreateQrisPaymentDto, CreateVirtualAccountDto } from './dto/payment.dto.js';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Endpoint Diagnosa & Uji Koneksi Gateway Xendit
   * Mendukung GET /api/payments/test-connection maupun GET /payments/test-connection
   */
  @Get('test-connection')
  async testConnection() {
    return this.paymentService.testConnection();
  }

  /**
   * Endpoint pembuatan QRIS Dinamis
   */
  @Post('create-qris')
  async createQris(@Body() dto: CreateQrisPaymentDto) {
    const data = await this.paymentService.createQrisPayment(
      dto.reservationId,
      dto.amount,
    );
    return {
      success: true,
      message: 'QRIS Dinamis berhasil dibuat',
      data,
    };
  }

  /**
   * Endpoint pembuatan Virtual Account (BCA, BNI, BRI, Mandiri)
   */
  @Post('create-va')
  async createVirtualAccount(@Body() dto: CreateVirtualAccountDto) {
    const data = await this.paymentService.createVirtualAccount(
      dto.reservationId,
      dto.bankCode,
      dto.customerName,
      dto.amount,
    );
    return {
      success: true,
      message: `Virtual Account ${dto.bankCode} berhasil dibuat`,
      data,
    };
  }

  /**
   * Endpoint Webhook Notifikasi Real-Time dari Xendit
   * Mendukung POST /api/payments/webhook maupun /payments/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-callback-token') callbackToken: string,
    @Body() payload: any,
  ) {
    return this.paymentService.handleWebhook(callbackToken, payload);
  }

  /**
   * Endpoint Cek Status Pembayaran (Auto-Polling Frontend)
   */
  @Get('status/:id')
  async getStatus(@Param('id', ParseIntPipe) id: number) {
    const data = await this.paymentService.getPaymentStatus(id);
    return {
      success: true,
      data,
    };
  }

  /**
   * Helper Sandbox Simulator: Verifikasi Langsung Pembayaran di Lingkungan Pengujian
   */
  @Post('simulate-success/:id')
  async simulateSuccess(@Param('id', ParseIntPipe) id: number) {
    const webhookToken = process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN || 'tablify_xendit_webhook_token_2026';
    const payload = {
      event: 'virtual_account.paid',
      status: 'COMPLETED',
      external_id: `RES-${id}-${Date.now()}`,
      amount: 50000,
    };
    return this.paymentService.handleWebhook(webhookToken, payload);
  }
}
