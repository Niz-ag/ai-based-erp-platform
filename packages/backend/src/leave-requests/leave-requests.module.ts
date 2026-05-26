import { Module } from '@nestjs/common';
import { LeaveRequestsController, LeaveBalancesController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [LeaveRequestsController, LeaveBalancesController],
  providers: [LeaveRequestsService, PrismaService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}