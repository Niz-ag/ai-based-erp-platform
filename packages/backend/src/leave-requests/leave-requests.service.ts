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

    // Check if employee is active
    const employee = await this.prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { isActive: true },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    if (!employee.isActive) {
      throw new Error('Cannot create leave request for an inactive employee');
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    
    if (end < start) {
      throw new Error('End date cannot be before start date');
    }

    // Calculate days per year, excluding weekends
    const daysPerYear: Record<number, number> = {};
    const current = new Date(start);
    let totalRequestedDays = 0;

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
        const y = current.getFullYear();
        let dayValue = 1;
        
        // Half-day support: only applicable if it's a single day request or specifically marked
        if (data.isHalfDay && start.toDateString() === end.toDateString()) {
          dayValue = 0.5;
        }

        daysPerYear[y] = (daysPerYear[y] || 0) + dayValue;
        totalRequestedDays += dayValue;
      }
      current.setDate(current.getDate() + 1);
    }

    if (totalRequestedDays === 0 && !data.isHalfDay) {
       throw new Error('Leave request cannot be only on weekends');
    }

    // Check balances for each year
    for (const [yearStr, days] of Object.entries(daysPerYear)) {
      const year = parseInt(yearStr);
      let balance = await this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveType_year: {
            employeeId: data.employeeId,
            leaveType: data.leaveType,
            year: year,
          },
        },
      });

      // Auto-initialize balance if missing
      if (!balance) {
        balance = await this.prisma.leaveBalance.create({
          data: {
            employeeId: data.employeeId,
            leaveType: data.leaveType,
            year: year,
            totalDays: 20, // Default
            usedDays: 0,
            tenantId: tenantId!,
          },
        });
      }

      if (Number(balance.usedDays) + days > Number(balance.totalDays)) {
        throw new Error(`Insufficient leave balance for year ${year}. Requested: ${days}, Available: ${Number(balance.totalDays) - Number(balance.usedDays)}`);
      }
    }

    // Workflow #XX: Prevent overlapping requests
    const overlappingRequests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: data.employeeId,
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (overlappingRequests.length > 0) {
      throw new Error('Leave request dates overlap with an existing request');
    }

    return this.prisma.leaveRequest.create({
      data: {
        employee: { connect: { id: data.employeeId } },
        leaveType: data.leaveType,
        startDate: start,
        endDate: end,
        requestedDays: totalRequestedDays,
        isHalfDay: !!data.isHalfDay,
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

      // Calculate days per year, excluding weekends
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      
      const daysPerYear: Record<number, number> = {};
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const y = current.getFullYear();
          let dayValue = 1;
          if (request.isHalfDay && start.toDateString() === end.toDateString()) {
            dayValue = 0.5;
          }
          daysPerYear[y] = (daysPerYear[y] || 0) + dayValue;
        }
        current.setDate(current.getDate() + 1);
      }

      // Update balances for each year
      for (const [yearStr, days] of Object.entries(daysPerYear)) {
        const year = parseInt(yearStr);
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
          if (Number(balance.usedDays) + days > Number(balance.totalDays)) {
            throw new Error(`Insufficient leave balance for year ${year} for approval`);
          }
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: { increment: days } },
          });
        } else {
          // This should theoretically not happen if create initializes it, but good for safety
          await tx.leaveBalance.create({
            data: {
              employeeId: request.employeeId,
              leaveType: request.leaveType,
              year: year,
              totalDays: 20, // Default
              usedDays: days,
              tenantId: tenantId!,
            },
          });
        }
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

  async getMyLeaveBalances(currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (!tenantId) throw new Error('Tenant context missing');

    const employee = await this.prisma.employee.findFirst({
      where: {
        email: currentUser.email,
        tenantId: tenantId,
      },
    });

    if (!employee) {
      return [];
    }

    return this.getLeaveBalances(employee.id, currentUser);
  }
}