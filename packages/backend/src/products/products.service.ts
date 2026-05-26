import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.product.findMany({
      where: {
        tenantId: currentUser.tenantId,
        isActive: true,
      },
      include: { vendor: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: {
    name: string;
    sku: string;
    description?: string;
    unitPrice: number;
    unit?: string;
    vendorId?: string;
    reorderThreshold?: number;
  }, currentUser: CurrentUserData) {
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        unitPrice: data.unitPrice,
        unit: data.unit || 'ea',
        reorderThreshold: data.reorderThreshold || 10,
        vendor: data.vendorId ? { connect: { id: data.vendorId } } : undefined,
        tenant: { connect: { id: currentUser.tenantId } },
      },
    });

    // Create initial inventory record
    await this.prisma.inventory.create({
      data: {
        productId: product.id,
        quantity: 0,
        tenantId: currentUser.tenantId,
      },
    });

    return product;
  }
}