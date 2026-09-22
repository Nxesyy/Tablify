import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service.js';
import { ExportReportService } from './export-report.service.js';
import { UpdateAdminDto } from './dto/update-admin.dto.js';
import { CreateMemberAdminDto } from './dto/create-member-admin.dto.js';
import { UpdateMemberAdminDto } from './dto/update-member-admin.dto.js';
import { ExportReportDto } from './dto/export-report.dto.js';
import { CreateSpaceDto } from '../spaces/dto/create-space.dto.js';
import { UpdateSpaceDto } from '../spaces/dto/update-space.dto.js';
import { CreateDiskonDto } from '../diskon/dto/create-diskon.dto.js';
import { UpdateDiskonDto } from '../diskon/dto/update-diskon.dto.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';
import { Roles } from '../helper/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_SPACE')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly exportReportService: ExportReportService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. PROFIL LOKASI COWORKING SPACE (PANEL ADMIN) - PDF NO 25 & 26
  // ---------------------------------------------------------------------------
  @Get('profile')
  getProfile(@Req() req: any) {
    return this.adminService.getProfile(req.user.id);
  }

  @Put('profile')
  updateProfile(@Req() req: any, @Body() updateDto: UpdateAdminDto) {
    return this.adminService.updateProfile(req.user.id, updateDto);
  }

  // ---------------------------------------------------------------------------
  // 2. MANAJEMEN MEMBER / PELANGGAN (PANEL ADMIN) - PDF NO 27 s/d 31
  // ---------------------------------------------------------------------------
  @Get('members')
  findAllMembers(@Req() req: any, @Query('search') search?: string) {
    return this.adminService.findAllMembers(req.user.id, search);
  }

  // Alias kompatibilitas
  @Get('member')
  findAllMemberAlias(@Req() req: any, @Query('search') search?: string) {
    return this.adminService.findAllMembers(req.user.id, search);
  }

  @Post('members')
  createMember(@Body() createDto: CreateMemberAdminDto) {
    return this.adminService.createMember(createDto);
  }

  @Get('members/:id')
  findMemberById(@Param('id') id: string) {
    return this.adminService.findMemberById(+id);
  }

  @Put('members/:id')
  updateMember(
    @Param('id') id: string,
    @Body() updateDto: UpdateMemberAdminDto,
  ) {
    return this.adminService.updateMember(+id, updateDto);
  }

  @Delete('members/:id')
  deleteMember(@Param('id') id: string) {
    return this.adminService.deleteMember(+id);
  }

  // ---------------------------------------------------------------------------
  // 3. MANAJEMEN RUANGAN & MEJA SPACE (PANEL ADMIN) - PDF NO 32 s/d 36
  // ---------------------------------------------------------------------------
  @Get('spaces')
  findAllSpaces(@Req() req: any) {
    return this.adminService.findAllSpaces(req.user.id);
  }

  @Post('spaces')
  createSpace(@Req() req: any, @Body() createSpaceDto: CreateSpaceDto) {
    return this.adminService.createSpace(createSpaceDto, req.user.id);
  }

  @Get('spaces/:id')
  findSpaceById(@Param('id') id: string) {
    return this.adminService.findSpaceById(+id);
  }

  @Put('spaces/:id')
  updateSpacePut(
    @Param('id') id: string,
    @Body() updateSpaceDto: UpdateSpaceDto,
    @Req() req: any,
  ) {
    return this.adminService.updateSpace(+id, updateSpaceDto, req.user.id);
  }

  @Patch('spaces/:id')
  updateSpacePatch(
    @Param('id') id: string,
    @Body() updateSpaceDto: UpdateSpaceDto,
    @Req() req: any,
  ) {
    return this.adminService.updateSpace(+id, updateSpaceDto, req.user.id);
  }

  @Delete('spaces/:id')
  deleteSpace(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteSpace(+id, req.user.id);
  }

  // ---------------------------------------------------------------------------
  // 4. MANAJEMEN KODE PROMO & DISKON (PANEL ADMIN) - PDF NO 37 s/d 41
  // ---------------------------------------------------------------------------
  @Get('diskon')
  findAllDiskon(@Req() req: any) {
    return this.adminService.findAllDiskon(req.user.id);
  }

  @Post('diskon')
  createDiskon(@Req() req: any, @Body() createDiskonDto: CreateDiskonDto) {
    return this.adminService.createDiskon(createDiskonDto, req.user.id);
  }

  @Get('diskon/:id')
  findDiskonById(@Param('id') id: string, @Req() req: any) {
    return this.adminService.findDiskonById(+id, req.user.id);
  }

  @Put('diskon/:id')
  updateDiskonPut(
    @Param('id') id: string,
    @Body() updateDiskonDto: UpdateDiskonDto,
    @Req() req: any,
  ) {
    return this.adminService.updateDiskon(+id, updateDiskonDto, req.user.id);
  }

  @Patch('diskon/:id')
  updateDiskonPatch(
    @Param('id') id: string,
    @Body() updateDiskonDto: UpdateDiskonDto,
    @Req() req: any,
  ) {
    return this.adminService.updateDiskon(+id, updateDiskonDto, req.user.id);
  }

  @Delete('diskon/:id')
  deleteDiskon(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteDiskon(+id, req.user.id);
  }

  // ---------------------------------------------------------------------------
  // 5. TRANSAKSI RESERVASI & CHECK-IN/CHECK-OUT (PANEL ADMIN) - PDF NO 42 s/d 45
  // ---------------------------------------------------------------------------
  @Get('reservasi')
  findAllReservations(
    @Req() req: any,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('status') status?: string,
    @Query('id_space') id_space?: number,
    @Query('tanggal') tanggal?: string,
  ) {
    return this.adminService.findAllReservations(req.user.id, {
      month,
      year,
      status,
      id_space,
      tanggal,
    });
  }

  @Patch('reservasi/:id/status')
  updateReservationStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any,
  ) {
    return this.adminService.updateReservationStatus(+id, status, req.user.id);
  }

  @Post('reservasi/:id/check-in')
  checkInReservation(@Param('id') id: string, @Req() req: any) {
    return this.adminService.checkInReservation(+id, req.user.id);
  }

  @Post('reservasi/:id/check-out')
  checkOutReservation(@Param('id') id: string, @Req() req: any) {
    return this.adminService.checkOutReservation(+id, req.user.id);
  }

  // ---------------------------------------------------------------------------
  // 6. REKAPITULASI LAPORAN PENDAPATAN BULANAN (PANEL ADMIN) - PDF NO 46 & 47
  // ---------------------------------------------------------------------------
  @Get('reports/monthly')
  getMonthlyReport(
    @Req() req: any,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.adminService.getMonthlyReport(req.user.id, month, year);
  }

  @Get('reports/income')
  getIncomeReport(
    @Req() req: any,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.adminService.getIncomeReport(req.user.id, month, year);
  }

  // ---------------------------------------------------------------------------
  // 7. LAPORAN KEUANGAN & ANALISIS OKUPANSI (FRONTEND DASHBOARD & EXPORT)
  // ---------------------------------------------------------------------------
  @Get('reports/financial')
  getFinancialReport(
    @Req() req: any,
    @Query('bulan') bulan?: number,
    @Query('tahun') tahun?: number,
    @Query('rentang') rentang?: string,
  ) {
    return this.adminService.getFinancialReport(req.user.id, {
      bulan,
      tahun,
      rentang,
    });
  }

  @Get('reports/export')
  exportFinancialReport(
    @Req() req: any,
    @Query() query: ExportReportDto,
    @Res() res: Response,
  ) {
    return this.exportReportService.exportReport(req.user.id, query, res);
  }

  @Get('reports/occupancy')
  getOccupancyAnalytics(
    @Req() req: any,
    @Query('bulan') bulan?: number,
    @Query('tahun') tahun?: number,
  ) {
    return this.adminService.getOccupancyAnalytics(req.user.id, {
      bulan,
      tahun,
    });
  }
}
