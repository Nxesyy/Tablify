import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateDiskonDto {
  @IsNotEmpty({ message: 'Kode kupon promo wajib diisi' })
  @IsString()
  kode_diskon: string;

  @IsNotEmpty({ message: 'ID Owner/gerai wajib disertakan' })
  @Type(() => Number)
  @IsInt()
  id_owner: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  subtotal?: number;

  @IsOptional()
  tanggal?: string;
}
