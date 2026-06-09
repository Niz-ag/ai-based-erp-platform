import { Injectable, NotFoundException, BadRequestException, ForbiddenException, PreconditionFailedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, Prisma } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(currentUser: CurrentUserData) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (currentUser.vendorId) {
      where.vendorId = currentUser.vendorId;
    }

    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: true,
        lines: {
          include: { product: true },
        },
      },
      orderBy: { orderDate: 'desc' },
    });
  }

  async findOne(id: string, currentUser: CurrentUserData) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        lines: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    if (currentUser.vendorId && order.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You do not have access to this purchase order');
    }

    return order;
  }

  async create(data: {
    vendorId: string;
    expectedDate?: string;
    notes?: string;
    totalAmount?: number;
    lines: { 
      productId: string; 
      quantity: number; 
      unitPrice: number;
      uom?: string;
      uomFactor?: number;
    }[];
  }, currentUser: CurrentUserData) {
    // Generate order number
    const count = await this.prisma.purchaseOrder.count();
    const orderNumber = `PO-${Date.now()}-${count + 1}`;

    // Calculate total amount
    const calculatedTotal = data.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0,
    );

    // Validate total amount if provided
    if (data.totalAmount !== undefined && Math.abs(data.totalAmount - calculatedTotal) > 0.01) {
      throw new BadRequestException(
        `Total amount mismatch. Provided: ${data.totalAmount}, Calculated: ${calculatedTotal}`,
      );
    }

    if (currentUser.vendorId && data.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You can only create purchase orders for your own vendor');
    }

    const tenantId = tenantContextStorage.getStore()?.tenantId;

    // Fetch products to get default UOMs if not provided
    const productIds = data.lines.map(l => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    return this.prisma.purchaseOrder.create({
      data: {
        orderNumber,
        vendor: { connect: { id: data.vendorId } },
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes,
        totalAmount: calculatedTotal,
        createdBy: { connect: { id: currentUser.id } },
        tenant: { connect: { id: tenantId } },
        lines: {
          create: data.lines.map((line) => {
            const product = products.find(p => p.id === line.productId);
            return {
              product: { connect: { id: line.productId } },
              quantity: line.quantity,
              uom: line.uom || product?.purchaseUnit || 'ea',
              uomFactor: line.uomFactor || product?.purchaseFactor || 1.0,
              unitPrice: line.unitPrice,
              totalPrice: line.quantity * line.unitPrice,
              tenant: { connect: { id: tenantId } },
            };
          }),
        },
      },
      include: {
        vendor: true,
        lines: {
          include: { product: true },
        },
      },
    });
  }

  async approve(id: string, currentUser: CurrentUserData) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true }
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    if (currentUser.vendorId && order.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You do not have access to this purchase order');
    }

    if (order.status !== 'DRAFT' && order.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve order with status: ${order.status}`);
    }

    const updatedOrder = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        vendor: true,
        lines: { include: { product: true } },
      },
    });

    // Notify Creator
    this.notificationsService.createNotification(
      order.createdById,
      NotificationType.SUCCESS,
      'Purchase Order Approved',
      `Your PO ${order.orderNumber} has been approved.`,
      { orderId: order.id }
    ).catch(console.error);

    // Notify Vendor User (based on email match)
    if (order.vendor.email) {
      const vendorUser = await this.prisma.user.findFirst({
        where: { email: order.vendor.email, tenantId: order.tenantId }
      });
      if (vendorUser) {
        this.notificationsService.createNotification(
          vendorUser.id,
          NotificationType.INFO,
          'New Approved Purchase Order',
          `PO ${order.orderNumber} has been approved and is ready for fulfillment.`,
          { orderId: order.id }
        ).catch(console.error);
      }
    }

    return updatedOrder;
  }

  async receive(id: string, data: { items: { lineId: string; receivedQty: number }[] }, currentUser: CurrentUserData) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    if (currentUser.vendorId && order.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You do not have access to this purchase order');
    }

    if (order.status !== 'APPROVED' && order.status !== 'PARTIAL') {
      throw new BadRequestException(`Cannot receive order with status: ${order.status}`);
    }

    // Start transaction to update inventory and create transactions
    return this.prisma.$transaction(async (tx) => {
      const tenantId = tenantContextStorage.getStore()?.tenantId;
      let totalReceivedValue = 0;

      // Process each line in the update data
      for (const item of data.items) {
        const line = order.lines.find((l) => l.id === item.lineId);
        if (!line) continue;

        if (item.receivedQty <= 0) continue;

        // Update PO Line receivedQty
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            receivedQty: { increment: item.receivedQty },
          },
        });

        const baseQuantity = Math.round(item.receivedQty * Number(line.uomFactor));
        totalReceivedValue += item.receivedQty * Number(line.unitPrice);

        // Get or create inventory record
        let inventory = await tx.inventory.findUnique({
          where: { 
            productId_location_tenantId: {
              productId: line.productId,
              location: 'Main',
              tenantId: order.tenantId
            }
          },
        });

        if (!inventory) {
          inventory = await tx.inventory.create({
            data: {
              product: { connect: { id: line.productId } },
              location: 'Main',
              quantity: 0,
              tenant: { connect: { id: tenantId } },
            },
          });
        }

        // Update inventory quantity (add the converted quantity)
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { increment: baseQuantity } },
        });

        // Create inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            product: { connect: { id: line.productId } },
            inventory: { connect: { id: inventory.id } },
            quantity: baseQuantity,
            type: 'PURCHASE',
            reference: order.orderNumber,
            notes: `Items Received for PO: ${order.orderNumber} (Base Qty: ${baseQuantity})`,
            createdBy: { connect: { id: currentUser.id } },
            tenant: { connect: { id: tenantId } },
          },
        });
      }

      // Check if all lines are fully received
      const refreshedLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: id },
      });

      const allReceived = refreshedLines.every((l) => l.receivedQty >= l.quantity);
      const anyReceived = refreshedLines.some((l) => l.receivedQty > 0);
      const newStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : 'APPROVED';

      // Update order status
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus as any },
        include: {
          vendor: true,
          lines: { include: { product: true } },
        },
      });

      // 3. Create Journal Entry in Finance (Inventory Debit, AP Credit)
      if (totalReceivedValue > 0) {
        // Find Inventory and AP Accounts
        const inventoryAccount = await tx.account.findFirst({
          where: { code: '1200', tenantId },
        });
        const apAccount = await tx.account.findFirst({
          where: { code: '2000', tenantId },
        });

        if (!inventoryAccount || !apAccount) {
          throw new PreconditionFailedException(`Financial integration failed: Missing required accounts (Inventory: 1200, AP: 2000) for tenant ${tenantId}`);
        }

        // Generate journal entry number
        const sequence = await tx.sequence.upsert({
          where: { tenantId_name: { tenantId, name: 'journal_entry' } },
          update: { value: { increment: 1 } },
          create: { name: 'journal_entry', value: 1, tenant: { connect: { id: tenantId } } },
        });

        const entryNumber = `JE-${String(sequence.value).padStart(6, '0')}`;
        const taxAmount = totalReceivedValue * 0.10;
        const totalWithTax = totalReceivedValue + taxAmount;

        // Create the journal entry
        await tx.journalEntry.create({
          data: {
            entryNumber,
            date: new Date(),
            description: `PO Received (${newStatus}): ${order.orderNumber} - ${updatedOrder.vendor.name}`,
            status: 'POSTED', // Auto-post for PO receiving
            tenant: { connect: { id: tenantId } },
            createdBy: { connect: { id: currentUser.id } },
            lines: {
              create: [
                {
                  // Debit Inventory
                  account: { connect: { id: inventoryAccount.id } },
                  debit: totalReceivedValue,
                  tenant: { connect: { id: tenantId } },
                  description: `Inventory increase from PO ${order.orderNumber}`,
                },
                {
                  // Debit Tax Liability
                  account: { connect: { id: apAccount.id } },
                  debit: taxAmount,
                  tenant: { connect: { id: tenantId } },
                  description: `Tax liability from PO ${order.orderNumber}`,
                },
                {
                  // Credit Accounts Payable
                  account: { connect: { id: apAccount.id } },
                  credit: totalWithTax,
                  tenant: { connect: { id: tenantId } },
                  description: `Accounts Payable increase from PO ${order.orderNumber}`,
                },
              ],
            },
          },
        });

        // Update account balances since we set status to POSTED
        await tx.account.update({
          where: { id: inventoryAccount.id },
          data: { balance: { increment: totalReceivedValue } },
        });

        const taxAcct = await tx.account.findFirst({ where: { type: 'LIABILITY', code: '2100', tenantId } });
        if (taxAcct) {
          await tx.account.update({
            where: { id: taxAcct.id },
            data: { balance: { decrement: taxAmount } },
          });
        }

        await tx.account.update({
          where: { id: apAccount.id },
          data: { balance: { increment: totalWithTax } }, 
        });
      }

      // Trigger Webhook
      await this.webhooksService.trigger('PO_RECEIVED', {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        vendor: updatedOrder.vendor.name,
        receivedValue: totalReceivedValue,
        status: newStatus,
      }, currentUser.tenantId);

      // Create Notification for the user who created the PO
      this.notificationsService.createNotification(
        updatedOrder.createdById,
        NotificationType.SYSTEM,
        `Purchase Order ${allReceived ? 'Received' : 'Partially Received'}`,
        `PO ${updatedOrder.orderNumber} from ${updatedOrder.vendor.name} has been ${
          allReceived ? 'fully' : 'partially'
        } received.`,
        { orderId: updatedOrder.id }
      ).catch(console.error);

      return updatedOrder;
    });
  }

  async returnItems(id: string, data: { items: { lineId: string; returnQty: number }[] }, currentUser: CurrentUserData) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        vendor: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    if (currentUser.vendorId && order.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You do not have access to this purchase order');
    }

    const hasReceivedItems = order.lines.some(l => l.receivedQty > 0);
    if (!hasReceivedItems) {
      throw new BadRequestException('Cannot return items for an order with no received quantities.');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenantId = tenantContextStorage.getStore()?.tenantId;
      let totalReturnedValue = 0;

      for (const item of data.items) {
        const line = order.lines.find((l) => l.id === item.lineId);
        if (!line) continue;

        if (item.returnQty <= 0) continue;
        if (item.returnQty > line.receivedQty) {
          throw new BadRequestException(`Cannot return more than received. Line: ${line.product.sku}, Received: ${line.receivedQty}, Requested: ${item.returnQty}`);
        }

        // Update PO Line receivedQty (decrement)
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            receivedQty: { decrement: item.returnQty },
          },
        });

        const baseQuantity = Math.round(item.returnQty * Number(line.uomFactor));
        totalReturnedValue += item.returnQty * Number(line.unitPrice);

        // Get inventory record
        const inventory = await tx.inventory.findFirst({
          where: { productId: line.productId, tenantId },
        });

        if (!inventory || inventory.quantity < baseQuantity) {
          throw new BadRequestException(`Insufficient inventory to return ${line.product.sku}. Available: ${inventory?.quantity || 0}, Required: ${baseQuantity}`);
        }

        // Update inventory quantity (decrement)
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { decrement: baseQuantity } },
        });

        // Create inventory transaction (RETURN)
        await tx.inventoryTransaction.create({
          data: {
            product: { connect: { id: line.productId } },
            inventory: { connect: { id: inventory.id } },
            quantity: -baseQuantity,
            type: 'RETURN',
            reference: order.orderNumber,
            notes: `Items Returned for PO: ${order.orderNumber} (Base Qty: ${baseQuantity})`,
            createdBy: { connect: { id: currentUser.id } },
            tenant: { connect: { id: tenantId } },
          },
        });
      }

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RETURN' },
        include: {
          vendor: true,
          lines: { include: { product: true } },
        },
      });

      // 3. Create Debit Note in Finance (AP Debit, Inventory Credit)
      if (totalReturnedValue > 0) {
        const inventoryAccount = await tx.account.findFirst({
          where: { code: '1200', tenantId },
        });
        const apAccount = await tx.account.findFirst({
          where: { code: '2000', tenantId },
        });

        if (inventoryAccount && apAccount) {
          const sequence = await tx.sequence.upsert({
            where: { tenantId_name: { tenantId, name: 'journal_entry' } },
            update: { value: { increment: 1 } },
            create: { name: 'journal_entry', value: 1, tenant: { connect: { id: tenantId } } },
          });

          const entryNumber = `DN-${String(sequence.value).padStart(6, '0')}`;

          await tx.journalEntry.create({
            data: {
              entryNumber,
              date: new Date(),
              description: `Debit Note (PO Return): ${order.orderNumber} - ${order.vendor.name}`,
              status: 'POSTED',
              tenant: { connect: { id: tenantId } },
              createdBy: { connect: { id: currentUser.id } },
              lines: {
                create: [
                  {
                    // Debit Accounts Payable (Decrease Liability)
                    account: { connect: { id: apAccount.id } },
                    debit: totalReturnedValue,
                    tenant: { connect: { id: tenantId } },
                    description: `AP decrease from PO Return ${order.orderNumber}`,
                  },
                  {
                    // Credit Inventory (Decrease Asset)
                    account: { connect: { id: inventoryAccount.id } },
                    credit: totalReturnedValue,
                    tenant: { connect: { id: tenantId } },
                    description: `Inventory decrease from PO Return ${order.orderNumber}`,
                  },
                ],
              },
            },
          });

          // Update balances
          await tx.account.update({
            where: { id: apAccount.id },
            data: { balance: { decrement: totalReturnedValue } }, // Decrease Liability (Debit): decreases Credit balance
          });

          await tx.account.update({
            where: { id: inventoryAccount.id },
            data: { balance: { decrement: totalReturnedValue } },
          });

          // Reverse COGS Logic: Credit COGS (5000), Debit Inventory (1200)
          const cogsAccount = await tx.account.findFirst({ where: { code: '5000', tenantId } });
          if (cogsAccount) {
            await tx.account.update({
              where: { id: cogsAccount.id },
              data: { balance: { decrement: totalReturnedValue } },
            });
            await tx.account.update({
              where: { id: inventoryAccount.id },
              data: { balance: { increment: totalReturnedValue } },
            });
          }
        }
      }

      return updatedOrder;
    });
  }
}