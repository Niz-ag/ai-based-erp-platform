import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(currentUser: CurrentUserData) {
    const { tenantId } = currentUser;
    const [
      userCount,
      employeeCount,
      projectCount,
      purchaseOrderCount,
      accountCount,
      lowStockResult,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.project.count({ where: { isActive: true } }),
      this.prisma.purchaseOrder.count({ }),
      this.prisma.account.count({ where: { isActive: true } }),
      this.prisma.$queryRawUnsafe<[{ count: any }]>(`
        SELECT COUNT(*)::int as count
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
      `, tenantId),
    ]);

    return {
      users: userCount,
      employees: employeeCount,
      projects: projectCount,
      purchaseOrders: purchaseOrderCount,
      accounts: accountCount,
      lowStock: Number(lowStockResult[0]?.count || 0),
    };
  }

  async getRecentActivity(currentUser: CurrentUserData) {
    // For now, let's pull the most recent audit logs or just some recent records
    const [
      recentUsers,
      recentProjects,
      recentPO,
    ] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, email: true, createdAt: true },
      }),
      this.prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.purchaseOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, createdAt: true, status: true },
      }),
    ]);

    const activities = [
      ...recentUsers.map(u => ({ type: 'USER', message: `New user joined: ${u.email}`, time: u.createdAt })),
      ...recentProjects.map(p => ({ type: 'PROJECT', message: `Project created: ${p.name}`, time: p.createdAt })),
      ...recentPO.map(po => ({ type: 'PO', message: `Purchase Order ${po.orderNumber} is ${po.status}`, time: po.createdAt })),
    ];

    return activities
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 10);
  }

  async getLayout(currentUser: CurrentUserData) {
    return this.prisma.dashboardLayout.findUnique({
      where: {
        userId: currentUser.id,
      },
    });
  }

  async saveLayout(currentUser: CurrentUserData, layout: any) {
    return this.prisma.dashboardLayout.upsert({
      where: {
        userId: currentUser.id,
      },
      update: {
        layout,
      },
      create: {
        userId: currentUser.id,
        tenantId: currentUser.tenantId,
        layout,
      },
    });
  }
}
