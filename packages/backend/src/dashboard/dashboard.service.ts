import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(currentUser: CurrentUserData) {
    const [
      userCount,
      employeeCount,
      projectCount,
      purchaseOrderCount,
      accountCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: currentUser.tenantId } }),
      this.prisma.employee.count({ where: { tenantId: currentUser.tenantId, isActive: true } }),
      this.prisma.project.count({ where: { tenantId: currentUser.tenantId, isActive: true } }),
      this.prisma.purchaseOrder.count({ where: { tenantId: currentUser.tenantId } }),
      this.prisma.account.count({ where: { tenantId: currentUser.tenantId, isActive: true } }),
    ]);

    return {
      users: userCount,
      employees: employeeCount,
      projects: projectCount,
      purchaseOrders: purchaseOrderCount,
      accounts: accountCount,
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
        where: { tenantId: currentUser.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, email: true, createdAt: true },
      }),
      this.prisma.project.findMany({
        where: { tenantId: currentUser.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { tenantId: currentUser.tenantId },
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
}
