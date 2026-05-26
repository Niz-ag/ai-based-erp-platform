import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

export interface CreateProjectDto {
  name: string;
  description?: string;
  status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  plannedAmount?: number;
  currency?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  assigneeId?: string;
  prerequisiteTaskIds?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assigneeId?: string;
}

export interface CreateMilestoneDto {
  name: string;
  description?: string;
  dueDate?: string;
  projectId?: string;
}

export interface UpdateMilestoneDto {
  name?: string;
  description?: string;
  status?: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  dueDate?: string;
}

export interface UpdateBudgetDto {
  actualAmount?: number;
  plannedAmount?: number;
  notes?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  // ============ Projects ============

  async findAllProjects(currentUser: CurrentUserData) {
    return this.prisma.project.findMany({
      where: {
        tenantId: currentUser.tenantId,
        isActive: true,
      },
      include: {
        budget: true,
        _count: {
          select: {
            tasks: true,
            milestones: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProject(data: CreateProjectDto, currentUser: CurrentUserData) {
    const { plannedAmount, currency, ...projectData } = data;

    return this.prisma.project.create({
      data: {
        ...projectData,
        startDate: projectData.startDate ? new Date(projectData.startDate) : undefined,
        endDate: projectData.endDate ? new Date(projectData.endDate) : undefined,
        tenant: { connect: { id: currentUser.tenantId } },
        createdBy: { connect: { id: currentUser.id } },
        budget: plannedAmount
          ? {
              create: {
                plannedAmount: new Prisma.Decimal(plannedAmount || 0),
                currency: currency || 'USD',
                tenant: { connect: { id: currentUser.tenantId } },
              },
            }
          : undefined,
      },
      include: {
        budget: true,
      },
    });
  }

  async findProjectById(id: string, currentUser: CurrentUserData) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        budget: true,
        milestones: true,
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            dependencies: {
              include: {
                prerequisiteTask: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async updateProject(id: string, data: UpdateProjectDto, currentUser: CurrentUserData) {
    await this.findProjectById(id, currentUser);

    return this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        budget: true,
      },
    });
  }

  async deleteProject(id: string, currentUser: CurrentUserData) {
    await this.findProjectById(id, currentUser);

    return this.prisma.$transaction(async (tx) => {
      // Delete tasks
      await tx.task.deleteMany({ where: { projectId: id } });
      // Delete milestones
      await tx.milestone.deleteMany({ where: { projectId: id } });
      // Delete budget
      await tx.projectBudget.deleteMany({ where: { projectId: id } });
      // Delete project
      return tx.project.delete({ where: { id } });
    });
  }

  // ============ Tasks ============

  async createTask(projectId: string, data: CreateTaskDto, currentUser: CurrentUserData) {
    const { prerequisiteTaskIds, assigneeId, ...createData } = data;

    // Verify project exists
    await this.prisma.project.findFirst({
      where: { id: projectId, tenantId: currentUser.tenantId },
    });

    // Verify prerequisite tasks exist and belong to same project
    if (prerequisiteTaskIds && prerequisiteTaskIds.length > 0) {
      const existingTasks = await this.prisma.task.findMany({
        where: {
          id: { in: prerequisiteTaskIds },
          projectId,
          tenantId: currentUser.tenantId,
        },
      });
      if (existingTasks.length !== prerequisiteTaskIds.length) {
        throw new NotFoundException('One or more prerequisite tasks not found');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        ...createData,
        startDate: createData.startDate ? new Date(createData.startDate) : undefined,
        dueDate: createData.dueDate ? new Date(createData.dueDate) : undefined,
        estimatedHours: createData.estimatedHours
          ? new Prisma.Decimal(createData.estimatedHours)
          : undefined,
        project: { connect: { id: projectId } },
        tenant: { connect: { id: currentUser.tenantId } },
        assignee: assigneeId ? { connect: { id: assigneeId } } : undefined,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Create task dependencies
    if (prerequisiteTaskIds && prerequisiteTaskIds.length > 0) {
      await this.prisma.taskDependency.createMany({
        data: prerequisiteTaskIds.map((prereqId) => ({
          dependentTaskId: task.id,
          prerequisiteTaskId: prereqId,
        })),
      });
    }

    return this.findTaskById(task.id, currentUser);
  }

  async findTaskById(id: string, currentUser: CurrentUserData) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        dependencies: {
          include: {
            prerequisiteTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateTask(id: string, data: UpdateTaskDto, currentUser: CurrentUserData) {
    await this.findTaskById(id, currentUser);

    const updateData: any = { ...data };

    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }
    if (data.estimatedHours !== undefined) {
      updateData.estimatedHours = new Prisma.Decimal(data.estimatedHours);
    }
    if (data.actualHours !== undefined) {
      updateData.actualHours = new Prisma.Decimal(data.actualHours);
    }

    // Set completedAt when status changes to COMPLETED
    if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    // Handle assignee changes
    if (data.assigneeId !== undefined) {
      if (data.assigneeId) {
        updateData.assignee = { connect: { id: data.assigneeId } };
      } else {
        updateData.assignee = { disconnect: true };
      }
    }

    return this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // ============ Milestones ============

  async findAllMilestones(currentUser: CurrentUserData, projectId?: string) {
    return this.prisma.milestone.findMany({
      where: {
        tenantId: currentUser.tenantId,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createMilestone(data: CreateMilestoneDto, currentUser: CurrentUserData) {
    const { projectId, ...milestoneData } = data;

    if (!projectId) {
      throw new NotFoundException('projectId is required');
    }

    // Verify project exists
    await this.prisma.project.findFirst({
      where: { id: projectId, tenantId: currentUser.tenantId },
    });

    return this.prisma.milestone.create({
      data: {
        ...milestoneData,
        dueDate: milestoneData.dueDate ? new Date(milestoneData.dueDate) : undefined,
        project: { connect: { id: projectId } },
        tenant: { connect: { id: currentUser.tenantId } },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateMilestone(
    id: string,
    data: UpdateMilestoneDto,
    currentUser: CurrentUserData,
  ) {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const updateData: any = { ...data };

    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }

    // Set completedAt when status changes to COMPLETED
    if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    return this.prisma.milestone.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // ============ Budget ============

  async getProjectBudget(projectId: string, currentUser: CurrentUserData) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: currentUser.tenantId,
      },
      include: {
        budget: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const budget = project.budget;
    if (!budget) {
      return {
        projectId,
        projectName: project.name,
        plannedAmount: 0,
        actualAmount: 0,
        currency: 'USD',
        variance: 0,
        variancePercentage: 0,
        notes: null,
      };
    }

    const planned = Number(budget.plannedAmount);
    const actual = Number(budget.actualAmount);
    const variance = planned - actual;
    const variancePercentage = planned > 0 ? (variance / planned) * 100 : 0;

    return {
      projectId,
      projectName: project.name,
      plannedAmount: planned,
      actualAmount: actual,
      currency: budget.currency,
      variance,
      variancePercentage: Math.round(variancePercentage * 100) / 100,
      notes: budget.notes,
      updatedAt: budget.updatedAt,
    };
  }

  async updateProjectBudget(
    projectId: string,
    data: UpdateBudgetDto,
    currentUser: CurrentUserData,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: currentUser.tenantId,
      },
      include: {
        budget: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const updateData: any = { ...data };

    if (data.plannedAmount !== undefined) {
      updateData.plannedAmount = new Prisma.Decimal(data.plannedAmount);
    }
    if (data.actualAmount !== undefined) {
      updateData.actualAmount = new Prisma.Decimal(data.actualAmount);
    }

    if (project.budget) {
      return this.prisma.projectBudget.update({
        where: { id: project.budget.id },
        data: updateData,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else {
      // Create budget if it doesn't exist
      return this.prisma.projectBudget.create({
        data: {
          plannedAmount: new Prisma.Decimal(data.plannedAmount || 0),
          actualAmount: new Prisma.Decimal(data.actualAmount || 0),
          currency: 'USD',
          notes: data.notes,
          project: { connect: { id: projectId } },
          tenant: { connect: { id: currentUser.tenantId } },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }
  }
}