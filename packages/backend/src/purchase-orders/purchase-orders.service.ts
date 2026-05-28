import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(currentUser: CurrentUserData) {
    return this.prisma.purchaseOrder.findMany({
      include: {
        vendor: true,
        lines: {
          include: { product: true },
        },
      },
      orderBy: { orderDate: 'desc' },
    });
  }

  async create(data: {
    vendorId: string;
    expectedDate?: string;
    notes?: string;
    lines: { productId: string; quantity: number; unitPrice: number }[];
  }, currentUser: CurrentUserData) {
    // Generate order number
    const count = await this.prisma.purchaseOrder.count();
    const orderNumber = `PO-${Date.now()}-${count + 1}`;

    // Calculate total amount
    const totalAmount = data.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0,
    );

    const tenantId = tenantContextStorage.getStore()?.tenantId;

    return this.prisma.purchaseOrder.create({
      data: {
        orderNumber,
        vendor: { connect: { id: data.vendorId } },
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes,
        totalAmount,
        createdBy: { connect: { id: currentUser.id } },
        tenant: { connect: { id: tenantId } },
        lines: {
          create: data.lines.map((line) => ({
            product: { connect: { id: line.productId } },
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.quantity * line.unitPrice,
            tenant: { connect: { id: tenantId } },
          })),
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
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    if (order.status !== 'DRAFT' && order.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve order with status: ${order.status}`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        vendor: true,
        lines: { include: { product: true } },
      },
    });
  }

  async receive(id: string, currentUser: CurrentUserData) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    if (order.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot receive order with status: ${order.status}`);
    }

    // Start transaction to update inventory and create transactions
    return this.prisma.$transaction(async (tx) => {
      const tenantId = tenantContextStorage.getStore()?.tenantId;
      // Update order status to RECEIVED
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED' },
        include: {
          vendor: true,
          lines: { include: { product: true } },
        },
      });

      // Process each line - update inventory and create transactions
      for (const line of order.lines) {
        // Get or create inventory record
        let inventory = await tx.inventory.findUnique({
          where: { productId: line.productId },
        });

        if (!inventory) {
          inventory = await tx.inventory.create({
            data: {
              product: { connect: { id: line.productId } },
              quantity: 0,
              tenant: { connect: { id: tenantId } },
            },
          });
        }

        // Update inventory quantity (add the received quantity)
        const newQuantity = inventory.quantity + line.quantity;
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: newQuantity },
        });

        // Create inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            product: { connect: { id: line.productId } },
            inventory: { connect: { id: inventory.id } },
            quantity: line.quantity,
            type: 'PURCHASE',
            reference: order.orderNumber,
            notes: `Items Received for PO: ${order.orderNumber}`,
            createdBy: { connect: { id: currentUser.id } },
            tenant: { connect: { id: tenantId } },
          },
        });
      }

      // Trigger Webhook
      this.webhooksService.trigger('PO_RECEIVED', {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        vendor: updatedOrder.vendor.name,
        totalAmount: updatedOrder.totalAmount,
      }, currentUser.tenantId).catch(console.error);

      // Create Notification for the user who created the PO
      this.notificationsService.createNotification(
        updatedOrder.createdById,
        NotificationType.SYSTEM,
        'Purchase Order Received',
        `PO ${updatedOrder.orderNumber} from ${updatedOrder.vendor.name} has been fully received.`,
        { orderId: updatedOrder.id }
      ).catch(console.error);

      return updatedOrder;
    });
  }
        }