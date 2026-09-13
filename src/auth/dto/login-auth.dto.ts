import { IsNotEmpty, IsString, IsStrongPassword } from "class-validator";

export class login{

    @IsNotEmpty()
    @IsString()
    username: string;

    @IsNotEmpty()
    @IsStrongPassword()
    password: string;
}