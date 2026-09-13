import { PartialType } from '@nestjs/mapped-types';
import { CreateReservasiDto } from './create-reservasi.dto.js';

export class UpdateReservasiDto extends PartialType(CreateReservasiDto) {}
