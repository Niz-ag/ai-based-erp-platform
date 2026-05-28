import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../common/prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { PayrollProcessor } from './payroll.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'payroll',
    }),
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollProcessor, PrismaService],
  exports: [PayrollService],
})
export class PayrollModule {}
