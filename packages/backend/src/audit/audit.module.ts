import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { AuditProcessor } from './audit.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'audit',
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditProcessor, PrismaService],
  exports: [AuditService],
})
export class AuditModule {}
