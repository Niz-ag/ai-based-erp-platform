import { Injectable, UnauthorizedException, ConflictException, Inject, Logger } from '@nestjs/common';
// @ts-ignore
import { authenticator } from 'otplib';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { EmailService } from '../common/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
    private emailService: EmailService,
  ) {}

  /**
   * AI MANDATE: Cache Priming (Phase 2 Strategy)
   * We prime the Redis cache during login to ensure subsequent requests 
   * are ultra-fast and don't bottleneck the database.
   */
  private async primeUserCache(user: any) {
    const cacheKey = `user:${user.id}:v1`;
    const userData = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roleId: user.roleId,
      vendorId: user.vendorId,
      role: user.role,
    };
    try {
      await this.redis.set(cacheKey, JSON.stringify(userData), 300); // 5 min TTL
    } catch (e) {
      // Ignore cache priming failures to prevent login blocking
    }
  }

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
      if (user.mfaEnabled) {
        const mfaToken = this.jwtService.sign(
          { sub: user.id, type: 'mfa_pending', tenantId: user.tenantId },
          { expiresIn: '5m' },
        );
        return {
          mfaRequired: true,
          mfaToken,
          message: 'MFA verification required',
        };
      }

      // Prime the cache BEFORE returning the token
      await this.primeUserCache(user);

      return this.generateToken(user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async verifyMfa(mfaToken: string, otpCode: string) {
    try {
      const payload = this.jwtService.verify(mfaToken);
      if (payload.type !== 'mfa_pending') {
        throw new UnauthorizedException('Invalid MFA token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true, tenant: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Real TOTP validation
      if (!user.mfaSecret) {
        throw new UnauthorizedException('MFA not properly configured for this user');
      }

      const isValid = await this.verifyTOTP(otpCode, user.mfaSecret);
      if (!isValid) {
        throw new UnauthorizedException('Invalid OTP code');
      }

      await this.primeUserCache(user);
      return this.generateToken(user);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('MFA token expired');
      }
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('MFA verification failed');
    }
  }

  private verifyTOTP(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch (error) {
      return false;
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

      await this.primeUserCache(user);

      // Send Welcome Email (Workflow #45)
      try {
        await this.emailService.sendWelcomeEmail(user.email, user.firstName || user.email);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail registration if email fails
      }

      return this.generateToken(user);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async forgotPassword(email: string, tenantId?: string) {
    try {
      const whereClause: any = { email };
      if (tenantId) {
        whereClause.tenantId = tenantId;
      }

      const user = await this.prisma.user.findFirst({
        where: whereClause,
      });

      if (!user) {
        // Security: Don't reveal if user exists
        return { message: 'If an account exists for this email, you will receive a reset link.' };
      }

      const token = crypto.randomBytes(32).toString('hex');
      const cacheKey = `reset_token:${token}`;
      
      // Store in Redis for 15 minutes (900 seconds)
      await this.redis.set(cacheKey, user.id, 900);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl}/reset-password?token=${token}`;
      
      // Send Password Reset Email (Workflow #45)
      try {
        await this.emailService.sendNotificationEmail(
          user.email,
          'Password Reset Request',
          `You requested a password reset. Please click the button below to reset your password. This link will expire in 15 minutes.`,
          resetLink,
          'Reset Password'
        );
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
      }

      this.logger.log('--- PASSWORD RESET LINK (MANDATE #49) ---');
      this.logger.log(`User: ${user.email}`);
      this.logger.log(`Link: ${resetLink}`);
      this.logger.log('-------------------------------------------');

      return { message: 'If an account exists for this email, you will receive a reset link.' };
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const cacheKey = `reset_token:${token}`;
      const userId = await this.redis.get(cacheKey);

      if (!userId) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Delete token after use
      await this.redis.del(cacheKey);

      return { message: 'Password has been reset successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('Reset password error:', error);
      throw new Error('Failed to reset password');
    }
  }

  async findOrCreateFromSSO(data: { email: string; name: string; ssoId: string }) {
    let user = await this.prisma.user.findFirst({ 
      where: { email: data.email },
      include: { role: true, tenant: true },
    });

    if (!user) {
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

    await this.primeUserCache(user);
    return this.generateToken(user);
  }

  async generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roleId: user.roleId,
      vendorId: user.vendorId,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        vendorId: user.vendorId,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: typeof user.role.permissions === 'string' 
            ? JSON.parse(user.role.permissions) 
            : user.role.permissions
        },
        tenant: user.tenant.name,
      },
    };
  }
}
