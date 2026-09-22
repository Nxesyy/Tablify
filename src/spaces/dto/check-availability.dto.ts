import { IsISO8601, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckAvailabilityDto {
  @IsNotEmpty({ message: 'Tanggal reservasi wajib diisi (YYYY-MM-DD)' })
  tanggal_reservasi: string;

  @IsNotEmpty({ message: 'Jam mulai wajib diisi (ISO string atau HH:mm)' })
  jam_mulai: string;

  @IsNotEmpty({ message: 'Durasi jam wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'Durasi jam harus berupa bilangan bulat' })
  @Min(1, { message: 'Durasi sewa minimal 1 jam' })
  durasi_jam: number;
}
