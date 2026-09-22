import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ReservasiService } from './reservasi.service.js';
import { CreateReservasiDto } from './dto/create-reservasi.dto.js';
import { UpdateStatusReservasiDto } from './dto/update-status-reservasi.dto.js';
import { CheckInOutDto } from './dto/checkin-checkout.dto.js';
import { ExtendReservasiDto } from './dto/extend-reservasi.dto.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';
import { Roles } from '../helper/roles.decorator.js';

@Controller('reservasi')
export class ReservasiController {
  constructor(private readonly reservasiService: ReservasiService) {}

  /**
   * 1. Checkout Reservasi Meja (Khusus Member)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  @Post()
  checkout(@Body() createReservasiDto: CreateReservasiDto, @Req() req: any) {
    return this.reservasiService.checkout(createReservasiDto, req.user.id);
  }

  /**
   * 2. Riwayat Pemesanan Member (Dengan filter bulan, tahun, status)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  @Get('my-history')
  findMyHistory(
    @Req() req: any,
    @Query('bulan') bulan?: number,
    @Query('tahun') tahun?: number,
    @Query('status') status?: string,
  ) {
    return this.reservasiService.findMyHistory(req.user.id, {
      bulan,
      tahun,
      status,
    });
  }

  /**
   * 3. Daftar Reservasi Masuk Gerai (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Get('owner-reservations')
  findOwnerReservations(
    @Req() req: any,
    @Query('bulan') bulan?: number,
    @Query('tahun') tahun?: number,
    @Query('status') status?: string,
  ) {
    return this.reservasiService.findOwnerReservations(req.user.id, {
      bulan,
      tahun,
      status,
    });
  }

  /**
   * 4. E-Ticket & QR Code Payload
   */
  @Get('ticket/:kodeTiket')
  getTicket(@Param('kodeTiket') kodeTiket: string) {
    return this.reservasiService.getTicket(kodeTiket);
  }

  /**
   * 5. Fast Check-In Tamu Resepsionis (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Post('check-in')
  checkIn(@Body() dto: CheckInOutDto, @Req() req: any) {
    return this.reservasiService.checkIn(dto, req.user.id);
  }

  /**
   * 6. Fast Check-Out Tamu Resepsionis (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Post('check-out')
  checkOut(@Body() dto: CheckInOutDto, @Req() req: any) {
    return this.reservasiService.checkOut(dto, req.user.id);
  }

  /**
   * 7. Scan QR Code & Verifikasi Tiket Resepsionis (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Get('verify/:kodeTiket')
  verifyTicket(@Param('kodeTiket') kodeTiket: string, @Req() req: any) {
    return this.reservasiService.verifyTicket(kodeTiket, req.user.id);
  }

  /**
   * 8. Pembatalan Mandiri oleh Member
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  @Patch(':id/cancel')
  cancelByMember(@Param('id') id: string, @Req() req: any) {
    return this.reservasiService.cancelByMember(+id, req.user.id);
  }

  /**
   * 9. Update Status Reservasi / State Machine (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusReservasiDto,
    @Req() req: any,
  ) {
    return this.reservasiService.updateStatus(+id, dto, req.user.id);
  }

  /**
   * 10. Detail Satu Reservasi
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.reservasiService.findOne(+id, req.user.id, req.user.role);
  }

  /**
   * 11. Perpanjangan Durasi Fleksibel (Extend Booking Engine)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  @Post(':id/extend')
  extendBooking(
    @Param('id') id: string,
    @Body() dto: ExtendReservasiDto,
    @Req() req: any,
  ) {
    return this.reservasiService.extendBooking(+id, dto, req.user.id);
  }
}
