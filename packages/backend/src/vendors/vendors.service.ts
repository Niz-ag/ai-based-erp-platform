import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.vendor.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; code: string; email?: string; phone?: string; address?: string }, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    return this.prisma.vendor.create({
      data: {
        name: data.name,
        code: data.code,
        email: data.email,
        phone: data.phone,
        address: data.address,
        tenant: { connect: { id: tenantId } },
      },
    });
  }
}