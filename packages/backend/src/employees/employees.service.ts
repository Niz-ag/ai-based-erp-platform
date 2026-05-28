import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        department: true,
      },
      orderBy: { lastName: 'asc' },
    });
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

    return this.prisma.employee.create({
      data: employeeData,
      include: {
        department: true,
      },
    });
  }
}