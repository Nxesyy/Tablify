import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMemberAdminDto {
  @IsOptional()
  @IsString()
  nama_member?: string;

  @IsOptional()
  @IsString()
  instansi?: string;

  @IsOptional()
  @IsString()
  alamat?: string;

  @IsOptional()
  @IsString()
  telp?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  password?: string;

  @IsOptional()
  @IsString()
  foto?: string;
}
