import { IsNotEmpty, IsNumber, IsOptional, IsString, IsStrongPassword, Matches } from 'class-validator';

export class registerAdminDto {
  @IsNotEmpty({ message: 'Username wajib diisi' })
  username: string;

  @IsNotEmpty({ message: 'Password wajib diisi' })
  @IsStrongPassword()
  password: string;

  @IsNotEmpty({ message: 'Nama coworking wajib diisi' })
  nama_coworking: string;

  @IsNotEmpty({ message: 'Nama pemilik wajib diisi' })
  nama_pemilik: string;

  @IsNotEmpty({ message: 'Nomor telepon wajib diisi' })
  @IsString( { message: 'Nomor telepon harus berupa string (" ")' })
  @Matches(/^[0-9]+$/, { message: 'Nomor telepon hanya boleh berisi angka'})
  telp: string;

  @IsOptional()
  @IsString()
  alamat?: string;
}