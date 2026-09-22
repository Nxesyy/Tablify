import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMemberAdminDto {
  @IsNotEmpty({ message: 'Username unik login member wajib diisi' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'Password awal untuk akun member wajib diisi' })
  @IsString()
  @MinLength(6, { message: 'Kata sandi minimal 6 karakter' })
  password: string;

  @IsNotEmpty({ message: 'Nama lengkap member baru wajib diisi' })
  @IsString()
  nama_member: string;

  @IsNotEmpty({ message: 'Nama instansi / asal organisasi member wajib diisi' })
  @IsString()
  instansi: string;

  @IsNotEmpty({ message: 'Alamat lengkap tempat tinggal member wajib diisi' })
  @IsString()
  alamat: string;

  @IsNotEmpty({ message: 'Nomor telepon aktif member wajib diisi' })
  @IsString()
  telp: string;

  @IsOptional()
  @IsString()
  foto?: string;
}
