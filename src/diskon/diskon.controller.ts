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
import { DiskonService } from './diskon.service.js';
import { CreateDiskonDto } from './dto/create-diskon.dto.js';
import { UpdateDiskonDto } from './dto/update-diskon.dto.js';
import { ValidateDiskonDto } from './dto/validate-diskon.dto.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';
import { Roles } from '../helper/roles.decorator.js';

@Controller('diskon')
export class DiskonController {
  constructor(private readonly diskonService: DiskonService) {}

  /**
   * Membuat kupon diskon promo baru (Khusus Admin Space)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Post()
  create(@Body() createDiskonDto: CreateDiskonDto, @Req() req: any) {
    return this.diskonService.create(createDiskonDto, req.user.id);
  }

  /**
   * Validasi kupon promo otomatis saat checkout (Bisa diakses publik / member)
   */
  @Post('validate')
  validatePromo(@Body() validateDto: ValidateDiskonDto) {
    return this.diskonService.validatePromo(validateDto);
  }

  /**
   * Melihat daftar kupon promo milik gerai admin yang sedang login
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Get()
  findAll(@Req() req: any) {
    return this.diskonService.findAll(req.user.id);
  }

  /**
   * Mengambil promo aktif gerai tertentu (Bisa diakses publik / member untuk melihat banner promo gerai)
   */
  @Get('owner/:id_owner')
  findActiveByOwner(@Param('id_owner') id_owner: string) {
    return this.diskonService.findActiveByOwner(+id_owner);
  }

  /**
   * Melihat detail kupon diskon
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.diskonService.findOne(+id, req.user.id);
  }

  /**
   * Update kupon diskon promo
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDiskonDto: UpdateDiskonDto,
    @Req() req: any,
  ) {
    return this.diskonService.update(+id, updateDiskonDto, req.user.id);
  }

  /**
   * Hapus kupon diskon
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.diskonService.remove(+id, req.user.id);
  }
}
