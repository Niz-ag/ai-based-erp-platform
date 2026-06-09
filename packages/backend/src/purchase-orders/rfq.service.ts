import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { tenantContextStorage } from '../common/tenant-context';
import { RFQStatus, Prisma } from '@prisma/client';
import { PurchaseOrdersService } from './purchase-orders.service';

@Injectable()
export class RFQService {
  constructor(
    private prisma: PrismaService,
    private poService: PurchaseOrdersService,
  ) {}

  async findAll(currentUser: CurrentUserData) {
    const where: Prisma.RequestForQuoteWhereInput = {};
    if (currentUser.vendorId) {
      where.vendorId = currentUser.vendorId;
    }

    return this.prisma.requestForQuote.findMany({
      where,
      include: {
        vendor: true,
        lines: { include: { product: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: CurrentUserData) {
    const rfq = await this.prisma.requestForQuote.findUnique({
      where: { id },
      include: {
        vendor: true,
        lines: { include: { product: true } },
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (currentUser.vendorId && rfq.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You do not have access to this RFQ');
    }

    return rfq;
  }

  async create(data: any, currentUser: CurrentUserData) {
    if (currentUser.vendorId && data.vendorId !== currentUser.vendorId) {
      throw new ForbiddenException('You can only create RFQs for your own vendor');
    }

    const tenantId = tenantContextStorage.getStore()?.tenantId;

    return this.prisma.requestForQuote.create({
      data: {
        rfqNumber: `RFQ-${Date.now()}`,
        vendor: { connect: { id: data.vendorId } },
        status: RFQStatus.PENDING,
        notes: data.notes,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        createdBy: { connect: { id: currentUser.id } },
        tenant: { connect: { id: tenantId } },
        lines: {
          create: data.lines.map((line: any) => ({
            product: { connect: { id: line.productId } },
            quantity: line.quantity,
            targetPrice: line.targetPrice,
            tenant: { connect: { id: tenantId } },
          })),
        },
      },
      include: { lines: true },
    });
  }

  async convertToPO(id: string, currentUser: CurrentUserData) {
    const rfq = await this.findOne(id, currentUser);

    if (rfq.status === 'ACCEPTED') {
      throw new BadRequestException('RFQ already converted to PO');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update RFQ status
      await tx.requestForQuote.update({
        where: { id },
        data: { status: RFQStatus.ACCEPTED },
      });

      // 2. Create PO
      return this.poService.create({
        vendorId: rfq.vendorId,
        notes: `Generated from ${rfq.rfqNumber}. ${rfq.notes || ''}`,
        lines: rfq.lines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: Number(line.targetPrice || 0), // Use target price as initial unit price
          uom: line.uom,
          uomFactor: Number(line.uomFactor),
        }))
      }, currentUser);
    });
  }
}
