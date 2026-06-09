import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        inventory: true,
        vendor: true,
      },
      orderBy: { name: 'asc' },
    });

    return products.map(product => {
      const totalQuantity = product.inventory.reduce((sum, i) => sum + i.quantity, 0);
      return {
        ...product,
        totalQuantity,
        // Return first inventory record details for legacy UI fields if needed
        inventoryId: product.inventory[0]?.id,
        location: product.inventory[0]?.location || 'Main',
      };
    });
  }

  async findLowStock(currentUser: CurrentUserData) {
    // Get all active products with their inventory records
    const allActive = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { inventory: true, vendor: true }
    });

    return allActive
      .map(product => {
        const totalQuantity = product.inventory.reduce((sum, i) => sum + i.quantity, 0);
        return {
          ...product,
          totalQuantity
        };
      })
      .filter(p => p.totalQuantity <= p.reorderThreshold)
      .map((product) => ({
        id: product.inventory[0]?.id, // For UI compat
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentQuantity: product.totalQuantity,
        reorderThreshold: product.reorderThreshold,
        vendor: product.vendor?.name,
        unit: product.unit,
        unitPrice: Number(product.unitPrice),
        isLowStock: true,
      }));
  }

  async adjust(id: string, data: { quantity: number; reasonCode: string; notes?: string }, currentUser: CurrentUserData) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });

    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenantId = tenantContextStorage.getStore()?.tenantId;
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
          product: { connect: { id: inventory.productId } },
          inventory: { connect: { id: inventory.id } },
          quantity: adjustmentQty,
          type: 'ADJUSTMENT',
          reasonCode: data.reasonCode,
          notes: data.notes || `Manual Adjustment: ${data.reasonCode}`,
          createdBy: { connect: { id: currentUser.id } },
          tenant: { connect: { id: tenantId } },
        },
      });

      return updated;
    });
  }

  async getSkuHistory(productId: string, currentUser: CurrentUserData) {
    return this.prisma.inventoryTransaction.findMany({
      where: { productId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBarcodeOrSku(query: string, currentUser: CurrentUserData) {
    return this.prisma.product.findFirst({
      where: {
        OR: [
          { sku: query },
          { barcode: query },
        ],
        isActive: true,
      },
      include: {
        inventory: true,
        vendor: true,
      },
    });
  }

  async transfer(data: { productId: string, fromLocation: string, toLocation: string, quantity: number, notes?: string }, currentUser: CurrentUserData) {
    return this.prisma.$transaction(async (tx) => {
      const tenantId = tenantContextStorage.getStore()?.tenantId;

      // 1. Decrease from source
      const fromInv = await tx.inventory.findFirst({
        where: { productId: data.productId, location: data.fromLocation, tenantId },
      });

      if (!fromInv || fromInv.quantity < data.quantity) {
        throw new Error('Insufficient stock at source location');
      }

      await tx.inventory.update({
        where: { id: fromInv.id },
        data: { quantity: { decrement: data.quantity } },
      });

      // 2. Increase at destination (upsert)
      await tx.inventory.upsert({
        where: {
          productId_location_tenantId: {
            productId: data.productId,
            location: data.toLocation,
            tenantId,
          },
        },
        update: { quantity: { increment: data.quantity } },
        create: {
          productId: data.productId,
          location: data.toLocation,
          quantity: data.quantity,
          tenantId,
        },
      });

      // 3. Log transactions
      await tx.inventoryTransaction.createMany({
        data: [
          {
            productId: data.productId,
            inventoryId: fromInv.id,
            quantity: -data.quantity,
            type: 'ADJUSTMENT',
            reasonCode: 'TRANSFER_OUT',
            notes: data.notes || `Transfer to ${data.toLocation}`,
            createdById: currentUser.id,
            tenantId,
          },
          // We'd need to find the destination inventory ID for the second log, 
          // or just log once as a TRANSFER type.
        ]
      });

      return { success: true };
    });
  }
}