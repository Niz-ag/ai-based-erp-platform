import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { Logger } from '@nestjs/common';
import { tenantContextStorage } from '../common/tenant-context';

@Processor('inventory')
export class LowStockProcessor extends WorkerHost {
  private readonly logger = new Logger(LowStockProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'check-low-stock') {
      this.logger.log('Starting low stock check for all tenants...');
      await this.checkAllTenantsLowStock();
      this.logger.log('Finished low stock check.');
    }
  }

  private async checkAllTenantsLowStock() {
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
      
      for (const tenant of tenants) {
        await tenantContextStorage.run({ tenantId: tenant.id }, async () => {
          const lowStockProducts: any[] = await this.prisma.$queryRawUnsafe(`
            SELECT p.*, COALESCE(i.total_qty, 0) as "totalQuantity"
            FROM products p
            LEFT JOIN (
              SELECT product_id, SUM(quantity) as total_qty
              FROM inventory
              WHERE tenant_id = $1
              GROUP BY product_id
            ) i ON p.id = i.product_id
            WHERE p.tenant_id = $1
              AND p."isActive" = true
              AND COALESCE(i.total_qty, 0) < p.reorder_threshold
          `, tenant.id);

          for (const product of lowStockProducts) {
            const totalQuantity = Number(product.totalQuantity || 0);
            // Create notification for admins
            const admins = await this.prisma.user.findMany({
              where: { 
                tenantId: tenant.id,
                role: { name: { in: ['Admin', 'SuperAdmin'] } }
              }
            });

            for (const admin of admins) {
              // Check if a similar unread notification already exists to avoid spamming
              const existingNotification = await this.prisma.notification.findFirst({
                where: {
                  tenantId: tenant.id,
                  title: 'Low Stock Alert',
                  data: {
                    path: ['sku'],
                    equals: product.sku
                  },
                  isRead: false,
                }
              });

              if (!existingNotification) {
                await this.prisma.notification.create({
                  data: {
                    title: 'Low Stock Alert',
                    message: `Product ${product.name} (${product.sku}) is low on stock. Current: ${totalQuantity}, Threshold: ${product.reorder_threshold}`,
                    type: 'SYSTEM',
                    userId: admin.id,
                    tenantId: tenant.id,
                    data: { sku: product.sku }
                  }
                });
              }
            }
          }
        });
      }
    } catch (err) {
      this.logger.error('Error in low stock background job:', err);
      throw err;
    }
  }
}
