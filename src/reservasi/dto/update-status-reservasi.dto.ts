import { IsEnum, IsNotEmpty } from 'class-validator';

export enum StatusReservasiEnum {
  Belum_Dikonfirmasi = 'Belum_Dikonfirmasi',
  Disetujui = 'Disetujui',
  aktif = 'aktif',
  selesai = 'selesai',
  dibatalkan = 'dibatalkan',
}

export class UpdateStatusReservasiDto {
  @IsNotEmpty({ message: 'Status baru wajib diisi' })
  @IsEnum(StatusReservasiEnum, {
    message:
      'Status harus salah satu dari: Belum_Dikonfirmasi, Disetujui, aktif, selesai, dibatalkan',
  })
  status: StatusReservasiEnum;
}
