import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roleId: string;
  vendorId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          if (req && req.query && req.query.token) {
            return req.query.token as string;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'amdox-secret-key-change-in-production',
    });
  }

  /**
   * AI MANDATE: Performance Hardening (No Vibe Coding)
   * Implements Redis caching to prevent database meltdown under 100M concurrent connections.
   * Only queries PostgreSQL if the user context is not present in the hot cache.
   */
  async validate(payload: JwtPayload) {
    const cacheKey = `user:${payload.sub}:v1`;
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // Fallback to DB if Redis is down
    }

    // Note: Prisma Extension will NOT filter here because AsyncLocalStorage is not yet populated
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const userData = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roleId: user.roleId,
      vendorId: user.vendorId,
      role: user.role,
    };

    try {
      // Cache for 5 minutes (300s) to balance performance and freshness
      await this.redis.set(cacheKey, JSON.stringify(userData), 300);
    } catch (e) {
      // Ignore cache failures
    }

    return userData;
  }
}
