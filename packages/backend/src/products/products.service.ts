import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.product.findMany({
      where: {
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
    initialQuantity?: number;
  }, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        unitPrice: data.unitPrice,
        unit: data.unit || 'ea',
        reorderThreshold: data.reorderThreshold || 10,
        vendor: data.vendorId ? { connect: { id: data.vendorId } } : undefined,
        tenant: { connect: { id: tenantId } },
      },
    });

    // Create initial inventory record
    await this.prisma.inventory.create({
      data: {
        product: { connect: { id: product.id } },
        quantity: data.initialQuantity || 0,
        tenant: { connect: { id: tenantId } },
      },
    });

    if (data.initialQuantity && data.initialQuantity > 0) {
      // Create initial transaction
      await this.prisma.inventoryTransaction.create({
        data: {
          product: { connect: { id: product.id } },
          inventory: { 
            connect: { 
              productId: product.id // This works because inventory has a unique constraint on productId
            } 
          },
          quantity: data.initialQuantity,
          type: 'ADJUSTMENT',
          notes: 'Initial stock',
          createdBy: { connect: { id: currentUser.id } },
          tenant: { connect: { id: tenantId } },
        },
      });
    }

    return product;
  }
}