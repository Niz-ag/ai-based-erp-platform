import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';

export interface LoginDto {
  email: string;
  password: string;
  tenantId?: string;
  mfaCode?: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
  roleId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const { email, password, tenantId } = loginDto;

      if (!email || !password) {
        throw new UnauthorizedException('Email and password are required');
      }

      const whereClause: any = { email };
      if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
        whereClause.tenantId = tenantId;
      }

      const user = await this.prisma.user.findFirst({
        where: whereClause,
        include: { role: true, tenant: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // MFA Enforcement (Requirement F-01)
      const roleName = user.role.name.toLowerCase();
      const isMfaRequired = roleName === 'admin' || roleName === 'superadmin';
      
      if (isMfaRequired && !loginDto.mfaCode) {
        return {
          mfaRequired: true,
          userId: user.id,
          message: 'MFA verification required (Enter 123456 for demo)',
        };
      }

      if (isMfaRequired && loginDto.mfaCode !== '123456') {
        throw new UnauthorizedException('Invalid MFA code');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roleId: user.roleId,
      };

      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          tenant: user.tenant.name,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(registerDto: RegisterDto) {
    try {
      const { email, password, firstName, lastName, tenantId, roleId } = registerDto;

      const existingUser = await this.prisma.user.findFirst({
        where: { email, tenantId },
      });

      if (existingUser) {
        throw new ConflictException('User already exists in this tenant');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          tenantId,
          roleId,
        },
        include: { role: true, tenant: true },
      });

      const payload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roleId: user.roleId,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          tenant: user.tenant.name,
        },
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async findOrCreateFromSSO(data: { email: string; name: string; ssoId: string }) {
    let user = await this.prisma.user.findFirst({ 
      where: { email: data.email },
      include: { role: true, tenant: true },
    });

    if (!user) {
      // Derive tenant from email domain
      const domain = data.email.split('@')[1];
      const tenant = await this.prisma.tenant.findUnique({
        where: { domain },
      });

      if (!tenant) {
        throw new UnauthorizedException(`No tenant registered for domain: ${domain}`);
      }

      const role = await this.prisma.role.findFirst({
        where: { name: 'User' },
      });

      if (!role) {
        throw new Error('Default User role not found. Please seed the database.');
      }

      // Create user from SSO - no password needed
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          firstName: data.name.split(' ')[0],
          lastName: data.name.split(' ').slice(1).join(' '),
          passwordHash: 'SSO_USER_NO_PASSWORD',
          tenantId: tenant.id,
          roleId: role.id,
          isActive: true,
        },
        include: { role: true, tenant: true },
      });
    }

    return this.generateToken(user);
  }

  async generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roleId: user.roleId,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        tenant: user.tenant.name,
      },
    };
  }
}