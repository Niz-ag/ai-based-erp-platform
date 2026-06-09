import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

class LoginRequestBody {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  mfaCode?: string;
}

class RegisterRequestBody {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  tenantId: string;

  @IsString()
  roleId: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginRequestBody) {
    const loginDto: LoginDto = {
      email: body.email,
      password: body.password,
      tenantId: body.tenantId,
      mfaCode: body.mfaCode,
    };
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() body: RegisterRequestBody) {
    const registerDto: RegisterDto = {
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      tenantId: body.tenantId,
      roleId: body.roleId,
    };
    return this.authService.register(registerDto);
  }

  @Post('verify-mfa')
  async verifyMfa(@Body() body: { mfaToken: string; otpCode: string }) {
    if (!body.mfaToken || !body.otpCode) {
      throw new UnauthorizedException('MFA token and OTP code are required');
    }
    return this.authService.verifyMfa(body.mfaToken, body.otpCode);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string; tenantId?: string }) {
    if (!body.email) {
      throw new UnauthorizedException('Email is required');
    }
    return this.authService.forgotPassword(body.email, body.tenantId);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token || !body.password) {
      throw new UnauthorizedException('Token and new password are required');
    }
    return this.authService.resetPassword(body.token, body.password);
  }
}