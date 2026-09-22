import { IsInt, Min } from 'class-validator';

export class ExtendReservasiDto {
  @IsInt({ message: 'Durasi tambahan harus berupa bilangan bulat (jam)' })
  @Min(1, { message: 'Durasi perpanjangan minimal 1 jam' })
  durasi_tambahan: number;
}
