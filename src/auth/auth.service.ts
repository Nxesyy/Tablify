import { Injectable, UnauthorizedException } from '@nestjs/common';
import { login } from './dto/login-auth.dto.js';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { registerAdminDto } from './dto/registerAdmin-auth.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';



@Injectable()
export class AuthService {
  constructor( private readonly prisma: PrismaService ) {}

  async registerMember(registerDto: RegisterAuthDto) {
    const { name, username, email, password} = registerDto;
    const existingUser =  await this.prisma.user.findUnique({
      where: {
        email,
      }
    })
    if(existingUser){
      return {
        success: false,
        message: "user already exist",
      }
    }
    const user = await this.prisma.member.create({
      data: {
        name,
        username,
        email,
        password
      }
    })
    return {
      success: true,
      message: "user created successfully",
      data: user
    };
  }

  async registerAdmin(registerAdmin: registerAdminDto) {
    const { username, password, nama_coworking, nama_pemilik, telp} = registerAdmin;
    const Admin = await this.prisma.create({
      data: {
        username,
        password,
        nama_coworking,
        nama_pemilik,
        telp: NaN
      }
    })
    if(!Admin){
      return{
        success: false,
        message:" Admin Not Created successfully",
      }
    }
    return {
      success: true,
      message: "Admin created successfully",
      data: Admin
    }
  }


  async create(login: login) {
    const {username, password} = login;

    const user = await this.prisma.member.findUnique({
      where: {
        username,
      }
    })

    const admin_space = await this.prisma.space_owner.findUnique({
      where: {
        username,
      }
    })

    const account = user || admin_space;
    if(!account) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isPasswordValid = account.password === password;
    if(!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = {id: account.id, username: account.username, email: account.email};
    return { success: true, message: 'Login successful', data: payload };
  }
}
