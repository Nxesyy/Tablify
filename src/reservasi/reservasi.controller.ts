import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ReservasiService } from './reservasi.service.js';
import { CreateReservasiDto } from './dto/create-reservasi.dto.js';
import { UpdateReservasiDto } from './dto/update-reservasi.dto.js';

@Controller('reservasi')
export class ReservasiController {
  constructor(private readonly reservasiService: ReservasiService) {}

  @Post()
  create(@Body() createReservasiDto: CreateReservasiDto) {
    return this.reservasiService.create(createReservasiDto);
  }

  @Get()
  findAll() {
    return this.reservasiService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reservasiService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReservasiDto: UpdateReservasiDto) {
    return this.reservasiService.update(+id, updateReservasiDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reservasiService.remove(+id);
  }
}
