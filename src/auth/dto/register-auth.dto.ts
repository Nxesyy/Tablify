import { IsEmail, IsNotEmpty, IsStrongPassword } from "class-validator";



export class RegisterAuthDto {

    @IsNotEmpty()
    name: string;

    @IsNotEmpty()
    username: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsStrongPassword()
    password: string;

}