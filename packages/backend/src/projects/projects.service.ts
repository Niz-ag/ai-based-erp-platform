import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
import { tenantContextStorage } from '../common/tenant-context';
import { FinanceService } from '../finance/finance.service';

export interface CreateProjectDto {
// ... (omitting lines for brevity in thought, but I must provide full context in tool call)
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
  prerequisiteTaskIds?: string[];
}

export interface CreateMilestoneDto {
  name: string;
  description?: string;
  dueDate?: string;
  projectId?: string;
  amount?: number;
}

export interface UpdateMilestoneDto {
  name?: string;
  description?: string;
  status?: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  dueDate?: string;
  amount?: number;
  generateInvoice?: boolean;
}

export interface UpdateBudgetDto {
  actualAmount?: number;
  plannedAmount?: number;
  notes?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private financeService: FinanceService,
  ) {}

  // ============ Projects ============

  async findAllProjects(currentUser: CurrentUserData) {
    return this.prisma.project.findMany({
      where: {
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
    const tenantId = tenantContextStorage.getStore()?.tenantId;

    return this.prisma.project.create({
      data: {
        ...projectData,
        startDate: projectData.startDate ? new Date(projectData.startDate) : undefined,
        endDate: projectData.endDate ? new Date(projectData.endDate) : undefined,
        createdBy: { connect: { id: currentUser.id } },
        tenant: { connect: { id: tenantId } },
        budget: plannedAmount
          ? {
              create: {
                plannedAmount: new Prisma.Decimal(plannedAmount || 0),
                currency: currency || 'USD',
                tenant: { connect: { id: tenantId } },
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
      where: { id: projectId },
    });

    // Verify prerequisite tasks exist and belong to same project
    if (prerequisiteTaskIds && prerequisiteTaskIds.length > 0) {
      const existingTasks = await this.prisma.task.findMany({
        where: {
          id: { in: prerequisiteTaskIds },
          projectId,
        },
      });
      if (existingTasks.length !== prerequisiteTaskIds.length) {
        throw new NotFoundException('One or more prerequisite tasks not found');
      }

      // Implement prerequisite task status validation
      if (data.status === 'IN_PROGRESS' || data.status === 'COMPLETED') {
        const incompletePrereqs = existingTasks.filter(t => t.status !== 'COMPLETED');
        if (incompletePrereqs.length > 0) {
          throw new BadRequestException(
            `Cannot start task in ${data.status} status because prerequisite tasks are not completed: ${incompletePrereqs
              .map((t) => t.title)
              .join(', ')}`,
          );
        }
      }
    }

    const tenantId = tenantContextStorage.getStore()?.tenantId;

    const task = await this.prisma.task.create({
      data: {
        ...createData,
        startDate: createData.startDate ? new Date(createData.startDate) : undefined,
        dueDate: createData.dueDate ? new Date(createData.dueDate) : undefined,
        estimatedHours: createData.estimatedHours
          ? new Prisma.Decimal(createData.estimatedHours)
          : undefined,
        project: { connect: { id: projectId } },
        assignee: assigneeId ? { connect: { id: assigneeId } } : undefined,
        tenant: { connect: { id: tenantId } },
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
          tenantId: currentUser.tenantId,
        })),
      });
    }

    return this.findTaskById(task.id, currentUser);
  }

  async findTaskById(id: string, currentUser: CurrentUserData) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
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
    const task = await this.findTaskById(id, currentUser);

    const updateData: any = { ...data };
    delete updateData.prerequisiteTaskIds;

    // Check prerequisites if status is changing to IN_PROGRESS or COMPLETED
    if (data.status === 'IN_PROGRESS' || data.status === 'COMPLETED') {
      const incompletePrereqs = task.dependencies.filter(
        (d: any) => d.prerequisiteTask.status !== 'COMPLETED',
      );
      if (incompletePrereqs.length > 0) {
        throw new BadRequestException(
          `Cannot move to ${data.status} because prerequisite tasks are not completed: ${incompletePrereqs
            .map((d: any) => d.prerequisiteTask.title)
            .join(', ')}`,
        );
      }
    }

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

    // Workflow #28: Task Status persistence & timestamps
    updateData.updatedAt = new Date();
    if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (data.status) {
      updateData.completedAt = null;
    }

    // Handle assignee changes
    if (data.assigneeId !== undefined) {
      if (data.assigneeId) {
        updateData.assignee = { connect: { id: data.assigneeId } };
      } else {
        updateData.assignee = { disconnect: true };
      }
    }

    // Handle dependencies update
    if (data.prerequisiteTaskIds !== undefined) {
      // Verify prerequisite tasks exist and belong to same project
      if (data.prerequisiteTaskIds.length > 0) {
        const existingTasks = await this.prisma.task.findMany({
          where: {
            id: { in: data.prerequisiteTaskIds },
            projectId: task.projectId,
          },
        });
        if (existingTasks.length !== data.prerequisiteTaskIds.length) {
          throw new NotFoundException('One or more prerequisite tasks not found');
        }

        // Cycle Detection: Check if adding these prerequisites creates a cycle
        // A cycle is created if taskId is already a prerequisite for any of the new prerequisiteTaskIds
        for (const prereqId of data.prerequisiteTaskIds) {
          const hasCycle = await this.checkIfTaskIsDependentOn(prereqId, id);
          if (hasCycle) {
            throw new BadRequestException(`Cannot add dependency: Task ${prereqId} already depends on task ${id}, creating a cycle.`);
          }
        }
      }

      await this.prisma.taskDependency.deleteMany({
        where: { dependentTaskId: id },
      });

      if (data.prerequisiteTaskIds.length > 0) {
        await this.prisma.taskDependency.createMany({
          data: data.prerequisiteTaskIds.map((prereqId) => ({
            dependentTaskId: id,
            prerequisiteTaskId: prereqId,
            tenantId: currentUser.tenantId,
          })),
        });
      }
    }

    const updatedTask = await this.prisma.task.update({
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

    // Trigger recalculation of project cost if actualHours or assignee changed
    if (data.actualHours !== undefined || data.assigneeId !== undefined) {
      const tenantId = tenantContextStorage.getStore()?.tenantId;
      if (tenantId) {
        await this.recalculateProjectCost(updatedTask.projectId, tenantId);
      }
    }

    return updatedTask;
  }

  async deleteTask(id: string, currentUser: CurrentUserData) {
    const task = await this.findTaskById(id, currentUser);
    const projectId = task.projectId;

    await this.prisma.task.delete({
      where: { id },
    });

    // Trigger recalculation of project cost
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    if (tenantId) {
      await this.recalculateProjectCost(projectId, tenantId);
    }

    return { success: true };
  }

  async recalculateProjectCost(projectId: string, tenantId: string) {
    // 1. Get all tasks for the project that have actualHours
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        tenantId,
        actualHours: { not: null },
      },
      include: {
        assignee: {
          select: { email: true },
        },
      },
    });

    if (tasks.length === 0) {
      // If no tasks have actual hours, cost is 0
      await this.updateBudgetActualAmount(projectId, 0, tenantId);
      return;
    }

    // 2. Get all unique emails of assignees to fetch employees in one go (Robust Matching)
    const assigneeEmails = Array.from(
      new Set(tasks.map((t) => t.assignee?.email).filter(Boolean)),
    ) as string[];

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        email: { in: assigneeEmails },
      },
      select: { email: true, hourlyRate: true },
    });

    // Create a map for fast lookup
    const hourlyRateMap = new Map<string, number>();
    employees.forEach((emp) => {
      if (emp.hourlyRate) {
        hourlyRateMap.set(emp.email, Number(emp.hourlyRate));
      }
    });

    // 3. Calculate total cost using the map
    let totalCost = 0;
    for (const task of tasks) {
      if (!task.actualHours || !task.assignee?.email) continue;

      const rate = hourlyRateMap.get(task.assignee.email);
      if (rate) {
        totalCost += Number(task.actualHours) * rate;
      }
    }

    // 4. Update project budget actualAmount
    await this.updateBudgetActualAmount(projectId, totalCost, tenantId);
  }

  private async updateBudgetActualAmount(projectId: string, totalCost: number, tenantId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { budget: true },
    });

    if (project) {
      if (project.budget) {
        await this.prisma.projectBudget.update({
          where: { id: project.budget.id },
          data: { actualAmount: new Prisma.Decimal(totalCost) },
        });
      } else {
        await this.prisma.projectBudget.create({
          data: {
            projectId,
            tenantId,
            actualAmount: new Prisma.Decimal(totalCost),
            plannedAmount: new Prisma.Decimal(0),
            currency: 'USD',
          },
        });
      }
    }
  }

  // ============ Resources ============

  async getResourceWorkload(currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;

    // 1. Get all users for the tenant
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    // 2. Get all PENDING and IN_PROGRESS tasks with estimatedHours
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        assigneeId: { not: null },
        project: {
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
      },
      select: {
        assigneeId: true,
        estimatedHours: true,
        actualHours: true,
      },
    });

    // 3. Aggregate hours per user
    const workloadMap = new Map<string, number>();
    tasks.forEach((task) => {
      if (task.assigneeId) {
        const est = Number(task.estimatedHours || 0);
        const act = Number(task.actualHours || 0);
        const remaining = Math.max(0, est - act);

        if (remaining > 0) {
          const currentHours = workloadMap.get(task.assigneeId) || 0;
          workloadMap.set(task.assigneeId, currentHours + remaining);
        }
      }
    });

    // 4. Format the result
    const capacity = 40; // Standard 40hr/week capacity
    return users.map((user) => {
      const assignedHours = workloadMap.get(user.id) || 0;
      const percentage = (assignedHours / capacity) * 100;

      return {
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        assignedHours,
        capacity,
        workloadPercentage: Math.min(Math.round(percentage), 200), // Cap at 200% for visualization
      };
    });
  }

  // ============ Milestones ============

  async findAllMilestones(currentUser: CurrentUserData, projectId?: string) {
    return this.prisma.milestone.findMany({
      where: {
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
      where: { id: projectId },
    });

    const tenantId = tenantContextStorage.getStore()?.tenantId;

    return this.prisma.milestone.create({
      data: {
        ...milestoneData,
        dueDate: milestoneData.dueDate ? new Date(milestoneData.dueDate) : undefined,
        amount: milestoneData.amount ? new Prisma.Decimal(milestoneData.amount) : undefined,
        project: { connect: { id: projectId } },
        tenant: { connect: { id: tenantId } },
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
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const updateData: any = { ...data };
    delete updateData.generateInvoice; // Remove non-Prisma field

    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }

    // Set completedAt when status changes to COMPLETED
    if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date();
      
      // Workflow #31: Milestone Billing
      if (data.generateInvoice && milestone.amount) {
        const tenantId = tenantContextStorage.getStore()?.tenantId;
        const project = await this.prisma.project.findUnique({ 
          where: { id: milestone.projectId },
        });

        // Find standard AR and Revenue accounts for the tenant
        const [arAccount, revAccount] = await Promise.all([
          this.prisma.account.findFirst({ 
            where: { tenantId, code: '1100' } // Accounts Receivable
          }),
          this.prisma.account.findFirst({ 
            where: { tenantId, code: '4000' } // Sales Revenue
          })
        ]);

        if (arAccount && revAccount) {
          const entry = await this.financeService.createJournalEntry({
            date: new Date(),
            description: `Milestone Billing: ${milestone.name} - ${project?.name}`,
            reference: `MS-${milestone.id.slice(0, 8)}`,
            lines: [
              { accountId: arAccount.id, debit: Number(milestone.amount), credit: 0 },
              { accountId: revAccount.id, debit: 0, credit: Number(milestone.amount) }
            ]
          }, currentUser);

          // Immediately post the journal entry to affect live balances
          await this.financeService.postJournalEntry(entry.id, currentUser);
        }
      }
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
async deleteMilestone(id: string, currentUser: CurrentUserData) {
  return this.prisma.milestone.delete({
    where: {
      id,
    },
  });
  }

  private async checkIfTaskIsDependentOn(taskId: string, potentialPrereqId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [taskId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === potentialPrereqId) {
      return true;
    }

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    // Find all tasks that currentId depends on
    const deps = await this.prisma.taskDependency.findMany({
      where: { dependentTaskId: currentId },
      select: { prerequisiteTaskId: true },
    });

    for (const dep of deps) {
      if (!visited.has(dep.prerequisiteTaskId)) {
        queue.push(dep.prerequisiteTaskId);
      }
    }
  }

  return false;
  }

  // ============ Budget ============
  async getProjectBudget(projectId: string, currentUser: CurrentUserData) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
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
      const tenantId = tenantContextStorage.getStore()?.tenantId;
      // Create budget if it doesn't exist
      return this.prisma.projectBudget.create({
        data: {
          plannedAmount: new Prisma.Decimal(data.plannedAmount || 0),
          actualAmount: new Prisma.Decimal(data.actualAmount || 0),
          currency: 'USD',
          notes: data.notes,
          project: { connect: { id: projectId } },
          tenant: { connect: { id: tenantId } },
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