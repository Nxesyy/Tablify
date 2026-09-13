import { IsNotEmpty, IsNumber, IsStrongPassword } from "class-validator";

export class registerAdminDto {

    @IsNotEmpty()
    username: String;

    @IsNotEmpty()
    @IsStrongPassword()
    password: String;

    @IsNotEmpty()
    nama_coworking:String

    @IsNotEmpty()
    nama_pemilik: String

    @IsNumber()
    telp: Number
}