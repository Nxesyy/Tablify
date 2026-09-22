import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDiskonDto {
  @IsNotEmpty({ message: 'Kode kupon promo wajib diisi (contoh: HEMAT20)' })
  @IsString()
  kode_diskon: string;

  @IsNotEmpty({ message: 'Nama diskon/promo wajib diisi' })
  @IsString()
  nama_diskkon: string;

  @IsNotEmpty({ message: 'Persentase diskon wajib diisi (0 - 100)' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Persentase diskon harus berupa angka' })
  @Min(1, { message: 'Persentase diskon minimal 1%' })
  @Max(100, { message: 'Persentase diskon maksimal 100%' })
  presentase_diskon: number;

  @IsNotEmpty({ message: 'Tanggal awal promo wajib diisi (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'Format tanggal awal tidak valid (gunakan format ISO/YYYY-MM-DD)' })
  tanggal_awal: string;

  @IsNotEmpty({ message: 'Tanggal akhir promo wajib diisi (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'Format tanggal akhir tidak valid (gunakan format ISO/YYYY-MM-DD)' })
  tanggal_akhir: string;
}
