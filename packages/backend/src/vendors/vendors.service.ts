import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    const where: any = { isActive: true };
    if (currentUser.vendorId) {
      where.id = currentUser.vendorId;
    }

    return this.prisma.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: CurrentUserData) {
    if (currentUser.vendorId && currentUser.vendorId !== id) {
      throw new ForbiddenException('You do not have access to this vendor');
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        products: true,
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        }
      }
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async getPerformance(id: string, currentUser: CurrentUserData) {
    if (currentUser.vendorId && currentUser.vendorId !== id) {
      throw new ForbiddenException('You do not have access to this vendor');
    }

    const tenantId = tenantContextStorage.getStore()?.tenantId;
    
    // 1. Calculate On-Time Delivery %
    // We strictly correlate InventoryTransactions to PO references (orderNumber)
    const completedPOs = await this.prisma.purchaseOrder.findMany({
      where: { 
        vendorId: id,
        tenantId,
        status: 'RECEIVED'
      }
    });

    if (completedPOs.length === 0) {
      return { status: 'No ratings yet', onTimeRate: null, qualityScore: null };
    }

    let onTimeCount = 0;
    for (const po of completedPOs) {
      // Find the latest 'PURCHASE' transaction for this specific PO reference
      const transactions = await this.prisma.inventoryTransaction.findMany({
        where: {
          reference: po.orderNumber,
          type: 'PURCHASE',
          tenantId
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      if (transactions.length > 0) {
        const latestArrival = transactions[0].createdAt;
        const isLate = po.expectedDate && latestArrival > po.expectedDate;
        if (!isLate) onTimeCount++;
      } else {
        // If it's RECEIVED but no transactions found (shouldn't happen), we consider it on time or skip
        onTimeCount++; 
      }
    }

    const onTimeRate = Math.round((onTimeCount / completedPOs.length) * 100);

    // 2. Calculate Quality Score based on returns (RMAs)
    // Only count returns that reference POs from this vendor
    const returns = await this.prisma.inventoryTransaction.count({
      where: {
        tenantId,
        type: 'RETURN',
        reference: {
          in: completedPOs.map(po => po.orderNumber)
        }
      }
    });

    // Simple score: 100% minus 5% for every return, min 0
    const qualityScore = Math.max(0, 100 - (returns * 5));

    return {
      status: 'Rated',
      onTimeRate: `${onTimeRate}%`,
      qualityScore: `${qualityScore}%`,
      totalPOs: completedPOs.length,
      totalReturns: returns
    };
  }

  async create(data: { name: string; code: string; email?: string; phone?: string; address?: string }, currentUser: CurrentUserData) {
    if (currentUser.vendorId) {
      throw new ForbiddenException('Vendor users cannot create new vendors');
    }

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