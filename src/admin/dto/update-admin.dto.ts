import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  nama_coworking?: string;

  @IsOptional()
  @IsString()
  nama_pemilik?: string;

  @IsOptional()
  @Matches(/^[0-9+ -]+$/, { message: 'Nomor telepon hanya boleh berisi angka dan simbol (+ -)' })
  telp?: string;

  @IsOptional()
  @IsString()
  alamat?: string;
}
