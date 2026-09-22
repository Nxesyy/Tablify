import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {

  // Fields for Member
  @IsOptional()
  @IsString()
  nama_member?: string;

  @IsOptional()
  @IsString()
  Instansi?: string;

  @IsOptional()
  @IsString()
  alamat?: string;

  @IsOptional()
  telp?: string | number;

  @IsOptional()
  @IsString()
  foto?: string;

  // Fields for Admin Space Owner
  @IsOptional()
  @IsString()
  nama_coworking?: string;

  @IsOptional()
  @IsString()
  nama_pemilik?: string;
}
