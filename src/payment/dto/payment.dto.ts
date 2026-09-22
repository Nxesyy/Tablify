import { IsNotEmpty, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateQrisPaymentDto {
  @IsNotEmpty({ message: 'ID Reservasi wajib diisi' })
  @IsNumber({}, { message: 'ID Reservasi harus berupa angka' })
  reservationId: number;

  @IsNotEmpty({ message: 'Nominal pembayaran wajib diisi' })
  @IsNumber({}, { message: 'Nominal pembayaran harus berupa angka' })
  amount: number;
}

export class CreateVirtualAccountDto {
  @IsNotEmpty({ message: 'ID Reservasi wajib diisi' })
  @IsNumber({}, { message: 'ID Reservasi harus berupa angka' })
  reservationId: number;

  @IsNotEmpty({ message: 'Kode Bank wajib dipilih' })
  @IsString()
  @IsIn(['BCA', 'BNI', 'BRI', 'MANDIRI', 'PERMATA', 'CIMB'], {
    message: 'Bank harus salah satu dari: BCA, BNI, BRI, MANDIRI, PERMATA, CIMB',
  })
  bankCode: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsNotEmpty({ message: 'Nominal pembayaran wajib diisi' })
  @IsNumber({}, { message: 'Nominal pembayaran harus berupa angka' })
  amount: number;
}
