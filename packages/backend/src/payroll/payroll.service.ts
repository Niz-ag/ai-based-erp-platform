import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PayrollStatus, PayslipStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { tenantContextStorage } from '../common/tenant-context';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('payroll') private payrollQueue: Queue,
  ) {}

  async getRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { payslips: true } } },
    });
  }

  /**
   * AI MANDATE: Offloading the Event Loop (Phase 2 Strategy)
   * Payroll creation for 10k+ employees is too heavy for a request thread.
   * We initialize the run in 'PROCESSING' state and offload to BullMQ.
   */
  async createRun(period: string, currency: string, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    // 1. Initialize the run record
    const run = await this.prisma.payrollRun.create({
      data: {
        period,
        currency,
        status: PayrollStatus.PROCESSING,
        tenant: { connect: { id: contextTenantId } },
      },
    });

    // 2. Offload the heavy calculation to the background worker
    await this.payrollQueue.add('process-run', {
      runId: run.id,
      tenantId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return run;
  }

  /**
   * Internal worker logic to calculate payroll for all active employees.
   */
  async processPayrollRun(runId: string, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    try {
      const [employees, taxSlabs] = await Promise.all([
        this.prisma.employee.findMany({ where: { isActive: true } }),
        this.prisma.taxSlab.findMany({ orderBy: { minIncome: 'asc' } }),
      ]);

      // Batch create payslips using a transaction
      await this.prisma.$transaction(async (tx) => {
        for (const emp of employees) {
          const grossSalaryNum = emp.salary ? Number(emp.salary.toString()) : 0;
          let tax = 0;
          
          for (const slab of taxSlabs) {
            if (grossSalaryNum >= slab.minIncome) {
              const maxIncome = slab.maxIncome || grossSalaryNum;
              const taxableInSlab = Math.min(grossSalaryNum, maxIncome) - slab.minIncome;
              tax += taxableInSlab * (slab.rate / 100) + slab.fixedAmount;
            }
          }

          await tx.payslip.create({
            data: {
              run: { connect: { id: runId } },
              employee: { connect: { id: emp.id } },
              grossSalary: grossSalaryNum,
              netSalary: grossSalaryNum - tax,
              taxDeduction: tax,
              status: PayslipStatus.DRAFT,
              tenant: { connect: { id: contextTenantId } },
            },
          });
        }

        // Update total employees and set status to DRAFT (ready for approval)
        await tx.payrollRun.update({
          where: { id: runId },
          data: { 
            status: PayrollStatus.DRAFT,
            totalEmployees: employees.length 
          },
        });
      });
    } catch (error) {
      this.logger.error(`Payroll processing failed for run ${runId}: ${error.message}`);
      await this.prisma.payrollRun.update({
        where: { id: runId },
        data: { status: PayrollStatus.DRAFT }, // Or add a FAILED status
      });
      throw error;
    }
  }

  async getRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { payslips: { include: { employee: true } } },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async approveRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status === PayrollStatus.APPROVED) throw new ForbiddenException('Already approved');

    await this.prisma.payrollRun.update({
      where: { id },
      data: { status: PayrollStatus.APPROVED },
    });

    await this.prisma.payslip.updateMany({
      where: { runId: id },
      data: { status: PayslipStatus.APPROVED },
    });

    return { success: true };
  }

  async getPayslips(runId: string) {
    return this.prisma.payslip.findMany({
      where: { runId },
      include: { employee: true },
    });
  }

  async getPayslip(id: string) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: { employee: true, run: true },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    return payslip;
  }

  async getTaxSlabs(tenantId: string) {
    return this.prisma.taxSlab.findMany({ 
      orderBy: { minIncome: 'asc' } 
    });
  }

  async createTaxSlab(data: { min: number; max: number; rate: number; fixed: number }, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    return this.prisma.taxSlab.create({
      data: {
        minIncome: data.min,
        maxIncome: data.max,
        rate: data.rate,
        fixedAmount: data.fixed,
        tenant: { connect: { id: contextTenantId } },
      },
    });
  }
}
