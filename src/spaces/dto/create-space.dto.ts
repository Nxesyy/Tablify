import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipeSpace {
  DESK = 'DESK',
  MEETING_ROOM = 'MEETING_ROOM',
  PRIVATE_OFFICE = 'PRIVATE_OFFICE',
}

export class CreateSpaceDto {
  @IsNotEmpty({ message: 'Nama space/meja wajib diisi' })
  @IsString()
  nama_space: string;

  @IsNotEmpty({ message: 'Tarif per jam wajib diisi' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Tarif per jam harus berupa angka' })
  @IsPositive({ message: 'Tarif per jam harus bernilai positif' })
  harga_per_jam: number;

  @IsNotEmpty({ message: 'Tipe space wajib diisi (DESK, MEETING_ROOM, PRIVATE_OFFICE)' })
  @IsEnum(TipeSpace, { message: 'Tipe space harus salah satu dari: DESK, MEETING_ROOM, PRIVATE_OFFICE' })
  tipe: TipeSpace;

  @IsNotEmpty({ message: 'Kapasitas kursi wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'Kapasitas harus berupa bilangan bulat' })
  @Min(1, { message: 'Kapasitas minimal 1 orang' })
  kapasitas: number;

  @IsOptional()
  @IsString()
  foto?: string;

  @IsNotEmpty({ message: 'Deskripsi fasilitas wajib diisi' })
  @IsString()
  deskripsi: string;
}
