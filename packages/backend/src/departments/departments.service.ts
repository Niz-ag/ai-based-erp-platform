import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.department.findMany({
      where: {
        tenantId: currentUser.tenantId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; description?: string; managerId?: string }, currentUser: CurrentUserData) {
    return this.prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        tenant: { connect: { id: currentUser.tenantId } },
      },
    });
  }
}