import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class GlobalSearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, currentUser: CurrentUserData) {
    if (!query || query.trim().length < 2) {
      return {
        users: [],
        products: [],
        projects: [],
        employees: [],
        milestones: [],
        tasks: [],
      };
    }

    const tenantId = currentUser.tenantId;
    const searchTerm = query.trim();

    const [users, products, projects, employees, milestones, tasks] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      }),
      this.prisma.product.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          sku: true,
        },
      }),
      this.prisma.project.findMany({
        where: {
          tenantId,
          name: { contains: searchTerm, mode: 'insensitive' },
        },
        take: 5,
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.employee.findMany({
        where: {
          tenantId,
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { employeeCode: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      }),
      this.prisma.milestone.findMany({
        where: {
          tenantId,
          name: { contains: searchTerm, mode: 'insensitive' },
        },
        take: 5,
        include: {
          project: true,
        },
      }),
      this.prisma.task.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 5,
        include: {
          project: true,
        },
      }),
    ]);

    return {
      users: users.map(u => ({
        id: u.id,
        title: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        subtitle: u.email,
        type: 'user',
        link: `/users?id=${u.id}`,
      })),
      products: products.map(p => ({
        id: p.id,
        title: p.name,
        subtitle: p.sku,
        type: 'product',
        link: `/inventory?id=${p.id}`,
      })),
      projects: projects.map(p => ({
        id: p.id,
        title: p.name,
        subtitle: 'Project',
        type: 'project',
        link: `/projects?id=${p.id}`,
      })),
      employees: employees.map(e => ({
        id: e.id,
        title: `${e.firstName} ${e.lastName}`,
        subtitle: e.employeeCode,
        type: 'employee',
        link: `/hr?id=${e.id}`,
      })),
      milestones: milestones.map(m => ({
        id: m.id,
        title: m.name,
        subtitle: `Milestone - ${m.project.name}`,
        type: 'milestone',
        link: `/projects?projectId=${m.projectId}&milestoneId=${m.id}`,
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        subtitle: `Task - ${t.project.name}`,
        type: 'task',
        link: `/projects?projectId=${t.projectId}&taskId=${t.id}`,
      })),
    };
  }
}
