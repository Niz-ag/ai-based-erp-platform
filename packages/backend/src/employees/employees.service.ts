import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    const roleName = currentUser.role?.name?.toLowerCase();
    const isAdmin = roleName === 'admin' || roleName === 'superadmin' || (currentUser.role as any) === 'admin' || (currentUser.role as any) === 'superadmin';

    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: true,
      },
      orderBy: { lastName: 'asc' },
    });

    if (!isAdmin) {
      return employees.map(employee => {
        const { salary, hourlyRate, ...rest } = employee as any;
        return rest;
      });
    }

    return employees;
  }

  async create(data: any, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    const employeeData: any = {
      employeeCode: data.employeeCode,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      position: data.position,
      tenant: { connect: { id: tenantId } },
    };

    if (data.hireDate) {
      employeeData.hireDate = new Date(data.hireDate);
    }

    if (data.salary) {
      employeeData.salary = data.salary;
    }

    if (data.departmentId) {
      employeeData.department = { connect: { id: data.departmentId } };
    }

    const employee = await this.prisma.employee.create({
      data: employeeData,
      include: {
        department: true,
      },
    });

    if (data.createSystemUser) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { name: 'User' },
      });

      if (defaultRole && tenantId) {
        const passwordHash = await bcrypt.hash('Welcome123', 10);
        await this.prisma.user.create({
          data: {
            email: employee.email,
            passwordHash,
            firstName: employee.firstName,
            lastName: employee.lastName,
            tenantId: tenantId,
            roleId: defaultRole.id,
            isActive: true,
          },
        });
      }
    }

    return employee;
  }

  async update(id: string, data: any, currentUser: CurrentUserData) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const updateData: any = {
      employeeCode: data.employeeCode,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      position: data.position,
      salary: data.salary,
      hourlyRate: data.hourlyRate,
      isActive: data.isActive,
    };

    if (data.hireDate) {
      updateData.hireDate = new Date(data.hireDate);
    }

    if (data.departmentId) {
      updateData.department = { connect: { id: data.departmentId } };
    } else if (data.departmentId === null || data.departmentId === "") {
      updateData.department = { disconnect: true };
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: updateData,
        include: {
          department: true,
        },
      });

      // If 'isActive' is toggled to false, automatically update the associated User record
      if (data.isActive === false) {
        await tx.user.updateMany({
          where: {
            email: updatedEmployee.email,
            tenantId: updatedEmployee.tenantId,
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return updatedEmployee;
    });
  }

  async remove(id: string, currentUser: CurrentUserData) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            payslips: true,
            attendance: true,
            leaveRequests: true,
          }
        }
      }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // If there are financial or attendance records, we MUST NOT hard delete.
    // Use soft delete by setting isActive to false.
    return this.prisma.$transaction(async (tx) => {
      // 1. Deactivate employee
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: { isActive: false }
      });

      // 2. Deactivate linked user by email
      await tx.user.updateMany({
        where: { 
          email: employee.email,
          tenantId: employee.tenantId,
          isActive: true
        },
        data: { isActive: false }
      });

      // 3. Unassign active tasks
      const user = await tx.user.findFirst({
        where: { email: employee.email, tenantId: employee.tenantId }
      });
      if (user) {
        await tx.task.updateMany({
          where: { assigneeId: user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
          data: { assigneeId: null }
        });
      }

      // 4. Cancel pending leave requests
      await tx.leaveRequest.updateMany({
        where: { employeeId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' }
      });

      return updatedEmployee;
    });
  }
}