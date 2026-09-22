import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class login {
    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsString()
    usernameOrEmail?: string;

    @IsNotEmpty({ message: 'Password wajib diisi' })
    password: string;
}