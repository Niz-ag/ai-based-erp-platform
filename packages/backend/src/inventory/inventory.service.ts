import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.inventory.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        product: {
          include: { vendor: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findLowStock(currentUser: CurrentUserData) {
    // Get all products with their inventory and check against reorder threshold
    const products = await this.prisma.product.findMany({
      where: {
        tenantId: currentUser.tenantId,
        isActive: true,
      },
      include: {
        inventory: true,
        vendor: true,
      },
    });

    // Filter products where inventory quantity is at or below reorder threshold
    const lowStockItems = products.filter(
      (product) => product.inventory && product.inventory.quantity <= product.reorderThreshold,
    );

    return lowStockItems.map((product) => ({
      id: product.inventory?.id,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentQuantity: product.inventory?.quantity || 0,
      reorderThreshold: product.reorderThreshold,
      vendor: product.vendor?.name,
      unit: product.unit,
      unitPrice: product.unitPrice,
      isLowStock: (product.inventory?.quantity || 0) <= product.reorderThreshold,
    }));
  }

  async adjust(id: string, data: { quantity: number; notes?: string }, currentUser: CurrentUserData) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id, tenantId: currentUser.tenantId },
    });

    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Calculate adjustment quantity
      const adjustmentQty = data.quantity - inventory.quantity;

      // Update inventory
      const updated = await tx.inventory.update({
        where: { id },
        data: { quantity: data.quantity },
      });

      // Create transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: inventory.productId,
          inventoryId: inventory.id,
          quantity: adjustmentQty,
          type: 'ADJUSTMENT',
          notes: data.notes || 'Manual Adjustment',
          tenantId: currentUser.tenantId,
          createdById: currentUser.id,
        },
      });

      return updated;
    });
  }
}