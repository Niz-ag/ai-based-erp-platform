import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.leaveRequest.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: any, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;

    return this.prisma.leaveRequest.create({
      data: {
        employee: { connect: { id: data.employeeId } },
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        tenant: { connect: { id: tenantId } },
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

  async approve(id: string, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!request) throw new Error('Leave request not found');
      if (request.status !== 'PENDING') throw new Error('Request already processed');

      // Calculate days (inclusive)
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const year = start.getFullYear();

      // Update balance
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveType_year: {
            employeeId: request.employeeId,
            leaveType: request.leaveType,
            year: year,
          },
        },
      });

      if (balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: { increment: diffDays } },
        });
      } else {
        // Create balance record if not exists (optionally with some default total days)
        await tx.leaveBalance.create({
          data: {
            employeeId: request.employeeId,
            leaveType: request.leaveType,
            year: year,
            totalDays: 20, // Default
            usedDays: diffDays,
            tenantId: tenantId!,
          },
        });
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: currentUser.id,
          reviewedAt: new Date(),
        },
      });
    });
  }

  async reject(id: string, currentUser: CurrentUserData) {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
      },
    });
  }

  async getLeaveBalances(employeeId: string, currentUser: CurrentUserData) {
    return this.prisma.leaveBalance.findMany({
      where: {
        employeeId,
      },
      orderBy: [{ leaveType: 'asc' }, { year: 'desc' }],
    });
  }
}