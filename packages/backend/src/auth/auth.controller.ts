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
}