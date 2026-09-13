import { Injectable } from '@nestjs/common';
import { CreateReservasiDto } from './dto/create-reservasi.dto.js';
import { UpdateReservasiDto } from './dto/update-reservasi.dto.js';

@Injectable()
export class ReservasiService {
  create(createReservasiDto: CreateReservasiDto) {
    return 'This action adds a new reservasi';
  }

  findAll() {
    return `This action returns all reservasi`;
  }

  findOne(id: number) {
    return `This action returns a #${id} reservasi`;
  }

  update(id: number, updateReservasiDto: UpdateReservasiDto) {
    return `This action updates a #${id} reservasi`;
  }

  remove(id: number) {
    return `This action removes a #${id} reservasi`;
  }
}
