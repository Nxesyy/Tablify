import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterAuthDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nama_member?: string;

  @IsNotEmpty({ message: 'Username wajib diisi' })
  username: string;

  @IsNotEmpty({ message: 'Password wajib diisi' })
  password: string;

  @IsOptional()
  @IsString()
  Instansi?: string;

  @IsOptional()
  @IsString()
  alamat?: string;

  @IsOptional()
  @IsString()
  foto?: string;

  @IsOptional()
  telp?: string | number;
}