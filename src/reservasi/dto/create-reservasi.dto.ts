import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservasiDto {
  @IsNotEmpty({ message: 'ID Meja/Ruangan (space) wajib diisi' })
  @Type(() => Number)
  @IsInt()
  id_space: number;

  @IsNotEmpty({ message: 'Tanggal reservasi wajib diisi (YYYY-MM-DD)' })
  tanggal_reservasi: string;

  @IsNotEmpty({ message: 'Jam mulai wajib diisi (format ISO atau HH:mm)' })
  jam_mulai: string;

  @IsOptional()
  @IsString()
  jam_selesai?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Durasi sewa minimal 1 jam' })
  durasi_jam?: number;

  @IsOptional()
  @IsString()
  metode_pembayaran?: string;

  @IsOptional()
  @IsString()
  kode_diskon?: string;
}
