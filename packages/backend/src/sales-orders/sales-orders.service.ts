import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';
import { SalesOrderStatus } from '@prisma/client';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class SalesOrdersService {
  constructor(
    private prisma: PrismaService,
    private financeService: FinanceService,
  ) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.salesOrder.findMany({
      include: {
        customer: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        lines: {
          include: { product: true },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: CurrentUserData) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        lines: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales order with ID ${id} not found`);
    }

    return order;
  }

  async create(data: any, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the Sales Order
      const order = await tx.salesOrder.create({
        data: {
          orderNumber: data.orderNumber || `SO-${Date.now()}`,
          customer: data.customerId ? { connect: { id: data.customerId } } : undefined,
          status: data.status || SalesOrderStatus.DRAFT,
          notes: data.notes,
          totalAmount: data.totalAmount || 0,
          createdBy: { connect: { id: currentUser.id } },
          tenant: { connect: { id: tenantId } },
          lines: {
            create: data.lines.map((line: any) => ({
              product: { connect: { id: line.productId } },
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              totalPrice: line.quantity * line.unitPrice,
              tenant: { connect: { id: tenantId } },
            })),
          },
        },
        include: { lines: true },
      });

      // 2. Reserve Inventory if status is not DRAFT
      if (order.status !== SalesOrderStatus.DRAFT && order.status !== SalesOrderStatus.CANCELLED) {
        await this.handleInventoryReservation(tx, order.lines, 'RESERVE');
      }

      return order;
    });
  }

  async updateStatus(id: string, status: SalesOrderStatus, currentUser: CurrentUserData) {
    const order = await this.findOne(id, currentUser);
    if (order.status === status) return order;

    return this.prisma.$transaction(async (tx) => {
      const holdsReservation = (st: SalesOrderStatus) => 
        st === SalesOrderStatus.PENDING || st === SalesOrderStatus.CONFIRMED;
      const isFulfilled = (st: SalesOrderStatus) => 
        st === SalesOrderStatus.SHIPPED || st === SalesOrderStatus.DELIVERED;

      // Handle reservation shifts
      if (order.status === SalesOrderStatus.DRAFT && (status !== SalesOrderStatus.DRAFT && status !== SalesOrderStatus.CANCELLED)) {
        // From DRAFT to active: Reserve
        await this.handleInventoryReservation(tx, order.lines, 'RESERVE');
      }
      
      if (holdsReservation(order.status) && status === SalesOrderStatus.CANCELLED) {
        // From active (unfulfilled) to CANCELLED: Release reservation
        await this.handleInventoryReservation(tx, order.lines, 'RELEASE');
      }

      if (!isFulfilled(order.status) && isFulfilled(status)) {
        // Moving to fulfilled: Convert reservation to actual deduction
        await this.handleInventoryReservation(tx, order.lines, 'FULFILL');
        
        // Workflow #34: Customer Invoicing
        const tenantId = tenantContextStorage.getStore()?.tenantId;
        const [arAccount, revAccount] = await Promise.all([
          tx.account.findFirst({ where: { tenantId, code: '1100' } }), // AR
          tx.account.findFirst({ where: { tenantId, code: '4000' } }), // Sales Rev
        ]);

        if (arAccount && revAccount) {
          const journalEntry = await this.financeService.createJournalEntry({
            date: new Date(),
            description: `Sales Invoice: ${order.orderNumber}`,
            reference: order.id,
            lines: [
              { accountId: arAccount.id, debit: Number(order.totalAmount), credit: 0 },
              { accountId: revAccount.id, debit: 0, credit: Number(order.totalAmount) }
            ]
          }, currentUser);
          
          // Optionally post it immediately
          await this.financeService.postJournalEntry(journalEntry.id, currentUser);
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status },
      });
    });
  }

  private async handleInventoryReservation(tx: any, lines: any[], action: 'RESERVE' | 'RELEASE' | 'FULFILL') {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    const userId = tenantContextStorage.getStore()?.userId;

    for (const line of lines) {
      // Find all inventory records for this product across all locations, prioritizing those with stock
      const inventories = await tx.inventory.findMany({
        where: { productId: line.productId, tenantId },
        orderBy: { quantity: 'desc' }, 
      });

      if (inventories.length === 0) {
        throw new BadRequestException(`No inventory record found for product ID ${line.productId}`);
      }

      let remainingToProcess = Number(line.quantity);

      if (action === 'RESERVE') {
        const totalAvailable = inventories.reduce((sum, inv) => sum + (inv.quantity - inv.reserved), 0);
        if (totalAvailable < remainingToProcess) {
          throw new BadRequestException(`Insufficient total stock for product ${line.productId}. Total available: ${totalAvailable}, Requested: ${remainingToProcess}`);
        }

        for (const inventory of inventories) {
          const available = inventory.quantity - inventory.reserved;
          if (available <= 0) continue;

          const toReserve = Math.min(remainingToProcess, available);
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { reserved: { increment: toReserve } },
          });
          remainingToProcess -= toReserve;
          if (remainingToProcess <= 0) break;
        }
      } else if (action === 'RELEASE') {
        for (const inventory of inventories) {
          if (inventory.reserved <= 0) continue;

          const toRelease = Math.min(remainingToProcess, inventory.reserved);
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { reserved: { decrement: toRelease } },
          });
          remainingToProcess -= toRelease;
          if (remainingToProcess <= 0) break;
        }
      } else if (action === 'FULFILL') {
        for (const inventory of inventories) {
          if (inventory.quantity <= 0) continue;

          const toDeduct = Math.min(remainingToProcess, inventory.quantity);
          // Deduct from both total quantity and reserved
          const reserveDeduction = Math.min(toDeduct, inventory.reserved);
          
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { 
              quantity: { decrement: toDeduct },
              reserved: { decrement: reserveDeduction }
            },
          });

          // Log transaction
          await tx.inventoryTransaction.create({
            data: {
              product: { connect: { id: line.productId } },
              inventory: { connect: { id: inventory.id } },
              quantity: -toDeduct,
              type: 'SALE',
              notes: 'Sales Order Fulfillment',
              createdBy: { connect: { id: userId } },
              tenant: { connect: { id: tenantId } },
            },
          });

          remainingToProcess -= toDeduct;
          if (remainingToProcess <= 0) break;
        }

        // COGS Logic: Debit COGS (5000), Credit Inventory (1200)
        const inventoryAccount = await tx.account.findFirst({ where: { code: '1200', tenantId } });
        const cogsAccount = await tx.account.findFirst({ where: { code: '5000', tenantId } });
        const product = await tx.product.findUnique({ where: { id: line.productId } });

        if (inventoryAccount && cogsAccount && product) {
          const cost = Number(product.unitPrice) * 0.7; // Estimated cost for COGS (could be refined with actual weighted avg cost)
          const totalCost = cost * Number(line.quantity);

          const jeCount = await tx.journalEntry.count();
          await tx.journalEntry.create({
            data: {
              entryNumber: `JE-SO-${Date.now()}-${jeCount}`, // Deterministic uniqueness in transaction
              date: new Date(),
              description: `COGS for Sale: ${product.name}`,
              status: 'POSTED',
              tenantId,
              createdById: userId,
              lines: {
                create: [
                  { accountId: cogsAccount.id, debit: totalCost, baseDebit: totalCost, tenantId },
                  { accountId: inventoryAccount.id, credit: totalCost, baseCredit: totalCost, tenantId },
                ]
              }
            }
          });

          // Update balances
          await tx.account.update({ where: { id: cogsAccount.id }, data: { balance: { increment: totalCost } } });
          await tx.account.update({ where: { id: inventoryAccount.id }, data: { balance: { decrement: totalCost } } });
        }
      }
    }
  }
}
