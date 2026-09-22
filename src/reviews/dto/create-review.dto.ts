import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt({ message: 'ID Reservasi harus berupa angka' })
  @Min(1, { message: 'ID Reservasi tidak valid' })
  id_reservasi: number;

  @IsInt({ message: 'Rating harus berupa angka bulat 1 sampai 5' })
  @Min(1, { message: 'Rating minimal 1 bintang' })
  @Max(5, { message: 'Rating maksimal 5 bintang' })
  rating: number;

  @IsString({ message: 'Komentar harus berupa teks' })
  @IsNotEmpty({ message: 'Komentar ulasan tidak boleh kosong' })
  komentar: string;
}
