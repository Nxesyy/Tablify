import { Injectable } from '@nestjs/common';
import { CreateDiskonDto } from './dto/create-diskon.dto.js';
import { UpdateDiskonDto } from './dto/update-diskon.dto.js';

@Injectable()
export class DiskonService {
  create(createDiskonDto: CreateDiskonDto) {
    return 'This action adds a new diskon';
  }

  findAll() {
    return `This action returns all diskon`;
  }

  findOne(id: number) {
    return `This action returns a #${id} diskon`;
  }

  update(id: number, updateDiskonDto: UpdateDiskonDto) {
    return `This action updates a #${id} diskon`;
  }

  remove(id: number) {
    return `This action removes a #${id} diskon`;
  }
}
