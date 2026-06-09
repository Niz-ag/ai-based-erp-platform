import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });
    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }
    return lead;
  }

  async create(data: any) {
    return this.prisma.lead.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return this.prisma.lead.update({
      where: { id },
      data,
    });
  }

  async convertToCustomer(id: string) {
    const lead = await this.findOne(id);
    const tenantId = tenantContextStorage.getStore()?.tenantId;

    if (lead.status === 'CONVERTED') {
      throw new BadRequestException('Lead is already converted to a customer');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Customer record
      const customer = await tx.customer.create({
        data: {
          name: lead.company || lead.name,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
          isActive: true,
          tenant: { connect: { id: tenantId } },
        },
      });

      // 2. Mark lead as CONVERTED and link to customer
      await tx.lead.update({
        where: { id },
        data: { 
          status: 'CONVERTED',
          customerId: customer.id
        },
      });

      return customer;
    });
  }
}
