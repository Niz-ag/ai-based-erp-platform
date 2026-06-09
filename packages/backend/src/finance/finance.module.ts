import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { BankRecService } from './bank-rec.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, BankRecService, PrismaService],
  exports: [FinanceService, BankRecService],
})
export class FinanceModule {}