import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService, PrismaService],
  exports: [PayrollService],
})
export class PayrollModule {}