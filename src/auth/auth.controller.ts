import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { login } from './dto/login-auth.dto.js';
import { RegisterAuthDto } from './dto/register-auth.dto.js';
import { registerAdminDto } from './dto/registerAdmin-auth.dto.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() createAuthDto: login) {
    return this.authService.create(createAuthDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterAuthDto) {
    return this.authService.registerMember(registerDto);
  }

  @Post('register-admin')
  registerAdmin(@Body() registerAdminDto: registerAdminDto) {
    return this.authService.registerAdmin(registerAdminDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: any){
    return this.authService.getProfile(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfilePatch(@Req() req: any, @Body() updateDto: any) {
    return this.authService.updateProfile(req.user.id, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  updateProfilePost(@Req() req: any, @Body() updateDto: any) {
    return this.authService.updateProfile(req.user.id, updateDto);
  }
}
