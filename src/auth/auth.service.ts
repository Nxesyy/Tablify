import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { login } from './dto/login-auth.dto.js';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { registerAdminDto } from './dto/registerAdmin-auth.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as Bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerMember(registerDto: RegisterAuthDto) {
    try {
      const { name, username, password, foto } = registerDto;
      const hashedPassword = await Bcrypt.hash(password, 10);
      const namaMember = registerDto.nama_member || registerDto.name || username;

      const user = await this.prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role: 'MEMBER',
          member: {
            create: {
              nama_member: namaMember,
              Instansi: registerDto.Instansi || '',
              alamat: registerDto.alamat || '',
              telp: registerDto.telp ? String(registerDto.telp) : '',
              foto: foto || null,
            },
          },
        },
        include: {
          member: true,
        },
      });
      return {
        success: true,
        message: 'user created successfully',
        data: user,
      };
    } catch (error) {
      console.log(error);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return {
          success: false,
          message: 'Username sudah digunakan, silakan gunakan username lain',
        };
      }
      throw error;
    }
  }


  async registerAdmin(registerAdmin: registerAdminDto) {
    try {
      const { username, password, nama_coworking, nama_pemilik, telp, alamat } = registerAdmin; 

      const hashedPassword = await Bcrypt.hash(password, 10);

      const admin = await this.prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role: 'ADMIN_SPACE',
          space_owner: {
            create: {
              nama_coworking,
              nama_pemilik,
              telp: String(telp),
              alamat: alamat || null,
            },
          },
        },
        include: {
          space_owner: true,
        },
      });

      return {
        success: true,
        message: 'Admin created successfully',
        data: admin,
      };
    } catch (error) {
      console.log(error);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return {
          success: false,
          message: 'Username admin sudah digunakan, silakan gunakan username lain',
        };
      }
      throw error;
    }
  }

  async create(login: login) {
    const username = login.username || (login as any).usernameOrEmail;
    const { password } = login;

    const account = await this.prisma.user.findUnique({
      where: {
        username,
      },
      include: {
        member: true,
        space_owner: true,
      },
    });

    if (!account) {
      throw new UnauthorizedException('Invalid username or password');
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await Bcrypt.compare(password, account.password);
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid && account.password === password) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = {
      id: account.id,
      username: account.username,
      role: account.role,
      profile: account.member || account.space_owner,
    };

    const token = await this.jwtService.signAsync({
      id: account.id,
      username: account.username,
      role: account.role,
    });

    return {
      success: true,
      message: 'Login successful',
      token,
      data: payload,
    };
  }

  async getProfile(userId: number){
    const user = await this.prisma.user.findUnique({
      where: {id: userId},
      include: {
        member: true,
        space_owner: true
      }
    })

    if (!user){
      throw new NotFoundException('user tidak ditemukan')
    }

    const {password, ...profileData} = user
    return {
      success: true,
      data: profileData
    }
  }

  async updateProfile(userId: number, updateDto: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: true,
        space_owner: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Update username if provided
    if (updateDto.username && updateDto.username !== user.username) {
      const usernameConflict = await this.prisma.user.findUnique({
        where: { username: updateDto.username },
      });
      if (usernameConflict) {
        throw new BadRequestException('Username sudah digunakan oleh akun lain');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { username: updateDto.username },
      });
    }

    // Update member profile if user is MEMBER
    if (user.role === 'MEMBER' && user.member) {
      await this.prisma.member.update({
        where: { id_user: userId },
        data: {
          nama_member: updateDto.nama_member ?? user.member.nama_member,
          Instansi: updateDto.Instansi ?? user.member.Instansi,
          alamat: updateDto.alamat ?? user.member.alamat,
          telp: updateDto.telp ? String(updateDto.telp) : user.member.telp,
          foto: updateDto.foto !== undefined ? updateDto.foto : user.member.foto,
        },
      });
    }

    // Update space_owner profile if user is ADMIN_SPACE
    if (user.role === 'ADMIN_SPACE' && user.space_owner) {
      await this.prisma.space_owner.update({
        where: { id_user: userId },
        data: {
          nama_coworking: updateDto.nama_coworking ?? user.space_owner.nama_coworking,
          nama_pemilik: updateDto.nama_pemilik ?? user.space_owner.nama_pemilik,
          telp: updateDto.telp ? String(updateDto.telp) : user.space_owner.telp,
          alamat: updateDto.alamat !== undefined ? updateDto.alamat : user.space_owner.alamat,
        },
      });
    }

    return this.getProfile(userId);
  }
  }

