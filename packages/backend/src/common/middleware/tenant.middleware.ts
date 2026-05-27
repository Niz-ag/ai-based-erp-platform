import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface TenantContext {
  tenantId: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // SECURITY: Never derive tenant context from unverified headers like 'x-tenant-id'.
    // Tenant context is now managed exclusively by the JwtStrategy and Guards
    // to prevent tenant spoofing.
    
    next();
  }
}