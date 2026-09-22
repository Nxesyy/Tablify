import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { SpacesService } from './spaces.service.js';
import { CreateSpaceDto } from './dto/create-space.dto.js';
import { UpdateSpaceDto } from './dto/update-space.dto.js';
import { CheckAvailabilityDto } from './dto/check-availability.dto.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';
import { Roles } from '../helper/roles.decorator.js';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  /**
   * Tambah meja/ruangan baru (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Post()
  create(@Body() createSpaceDto: CreateSpaceDto, @Req() req: any) {
    return this.spacesService.create(createSpaceDto, req.user.id);
  }

  /**
   * Melihat katalog meja/ruangan (Bisa diakses publik / member dengan opsi filter)
   */
  @Get()
  findAll(
    @Query('id_owner') id_owner?: number,
    @Query('tipe') tipe?: string,
    @Query('kapasitas_min') kapasitas_min?: number,
    @Query('search') search?: string,
  ) {
    return this.spacesService.findAll({ id_owner, tipe, kapasitas_min, search });
  }

  /**
   * Mengambil daftar kafe / gerai mitra terdaftar (Bisa diakses publik / member)
   */
  @Get('cafes')
  findAllCafes() {
    return this.spacesService.findAllCafes();
  }

  /**
   * Melihat katalog meja milik gerai admin yang sedang login
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Get('my-spaces')
  findMySpaces(@Req() req: any) {
    return this.spacesService.findMySpaces(req.user.id);
  }

  /**
   * Mengambil overview gerai mitra, daftar meja, dan live antrean meja sedang digunakan
   */
  @Get('overview/:ownerId')
  getMitraOverview(@Param('ownerId') ownerId: string) {
    return this.spacesService.getMitraOverview(+ownerId);
  }

  /**
   * Mesin Cek Ketersediaan Real-Time (Anti Double-Booking Engine)
   */
  @Get(':id/availability')
  checkAvailability(
    @Param('id') id: string,
    @Query() query: CheckAvailabilityDto,
  ) {
    return this.spacesService.checkAvailability(+id, query);
  }

  /**
   * Melihat detail spesifik meja/ruangan
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.spacesService.findOne(+id);
  }

  /**
   * Update data meja/ruangan (Khusus Admin Space pemilik gerai)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSpaceDto: UpdateSpaceDto,
    @Req() req: any,
  ) {
    return this.spacesService.update(+id, updateSpaceDto, req.user.id);
  }

  /**
   * Hapus meja/ruangan (Khusus Admin Space pemilik gerai)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.spacesService.remove(+id, req.user.id);
  }
}
