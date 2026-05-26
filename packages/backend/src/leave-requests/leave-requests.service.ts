import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmployee(employeeId: string, currentUser: CurrentUserData) {
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        tenantId: currentUser.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: any, currentUser: CurrentUserData) {
    return this.prisma.leaveRequest.create({
      data: {
        employee: { connect: { id: data.employeeId } },
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        tenant: { connect: { id: currentUser.tenantId } },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });
  }

  async getLeaveBalances(employeeId: string, currentUser: CurrentUserData) {
    return this.prisma.leaveBalance.findMany({
      where: {
        employeeId,
        tenantId: currentUser.tenantId,
      },
      orderBy: [{ leaveType: 'asc' }, { year: 'desc' }],
    });
  }
}