import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma.service';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService, 
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    }
  ],
  exports: [AuditService],
})
export class AuditModule {}