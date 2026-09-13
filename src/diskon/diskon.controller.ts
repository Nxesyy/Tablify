import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DiskonService } from './diskon.service.js';
import { CreateDiskonDto } from './dto/create-diskon.dto.js';
import { UpdateDiskonDto } from './dto/update-diskon.dto.js';

@Controller('diskon')
export class DiskonController {
  constructor(private readonly diskonService: DiskonService) {}

  @Post()
  create(@Body() createDiskonDto: CreateDiskonDto) {
    return this.diskonService.create(createDiskonDto);
  }

  @Get()
  findAll() {
    return this.diskonService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diskonService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDiskonDto: UpdateDiskonDto) {
    return this.diskonService.update(+id, updateDiskonDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diskonService.remove(+id);
  }
}
