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
    barcode?: string;
    description?: string;
    unitPrice: number;
    unit?: string;
    purchaseUnit?: string;
    purchaseFactor?: number;
    vendorId?: string;
    reorderThreshold?: number;
    initialQuantity?: number;
  }, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        description: data.description,
        unitPrice: data.unitPrice,
        unit: data.unit || 'ea',
        purchaseUnit: data.purchaseUnit || data.unit || 'ea',
        purchaseFactor: data.purchaseFactor || 1.0,
        reorderThreshold: data.reorderThreshold || 10,
        vendor: data.vendorId ? { connect: { id: data.vendorId } } : undefined,
        tenant: { connect: { id: tenantId } },
      },
    });

    // Create initial inventory record
    const inventory = await this.prisma.inventory.create({
      data: {
        product: { connect: { id: product.id } },
        location: 'Main',
        quantity: data.initialQuantity || 0,
        tenant: { connect: { id: tenantId } },
      },
    });

    if (data.initialQuantity && data.initialQuantity > 0) {
      // Create initial transaction
      await this.prisma.inventoryTransaction.create({
        data: {
          product: { connect: { id: product.id } },
          inventory: { connect: { id: inventory.id } },
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