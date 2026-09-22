import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInOutDto {
  @IsOptional()
  @IsString()
  kode_tiket?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_reservasi?: number;
}
