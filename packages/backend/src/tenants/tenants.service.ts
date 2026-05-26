import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    // Only admins can list all tenants
    const roleName = currentUser.role.name.toLowerCase();
    if (roleName !== 'admin' && roleName !== 'superadmin') {
      throw new ForbiddenException('Only admins can list all tenants');
    }
    
    return this.prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { users: true }
        }
      },
    });
  }

  async findOne(id: string, currentUser: CurrentUserData) {
    const roleName = currentUser.role.name.toLowerCase();
    // Users can only view their own tenant unless admin
    if (roleName !== 'admin' && roleName !== 'superadmin' && currentUser.tenantId !== id) {
      throw new ForbiddenException('Access denied to this tenant');
    }
    
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async create(data: Prisma.TenantCreateInput) {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        domain: data.domain,
      },
    });
  }

  async update(id: string, data: Prisma.TenantUpdateInput, currentUser: CurrentUserData) {
    const roleName = currentUser.role.name.toLowerCase();
    if (roleName !== 'admin' && roleName !== 'superadmin' && currentUser.tenantId !== id) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, currentUser: CurrentUserData) {
    const roleName = currentUser.role.name.toLowerCase();
    // Only superadmin can delete tenants
    if (roleName !== 'superadmin') {
      throw new ForbiddenException('Only superadmins can delete tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.delete({ where: { id } });
  }
}