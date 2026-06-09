import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PayrollStatus, PayslipStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { tenantContextStorage } from '../common/tenant-context';
import * as PDFDocument from 'pdfkit';
import { FinanceService } from '../finance/finance.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private financeService: FinanceService,
    @InjectQueue('payroll') private payrollQueue: Queue,
  ) {}

  async getRuns(tenantId: string) {
    const runs = await this.prisma.payrollRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { payslips: true } } },
    });

    // Calculate total amount for each run (sum of net salaries)
    return Promise.all(runs.map(async (run) => {
      const aggregate = await this.prisma.payslip.aggregate({
        where: { runId: run.id },
        _sum: { netSalary: true },
      });
      return {
        ...run,
        totalAmount: aggregate._sum.netSalary || 0,
      };
    }));
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
      tenantId: contextTenantId,
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
      // Check if payslips already exist for this run (idempotency check)
      const existingPayslipsCount = await this.prisma.payslip.count({
        where: { runId, tenantId: contextTenantId }
      });

      if (existingPayslipsCount > 0) {
        this.logger.warn(`Payslips already exist for run ${runId}. Skipping creation to ensure idempotency.`);
        await this.prisma.payrollRun.update({
          where: { id: runId },
          data: { status: PayrollStatus.DRAFT },
        });
        return;
      }

      const run = await this.prisma.payrollRun.findUnique({ where: { id: runId } });
      const period = run?.period || '';
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const [employees, taxSlabs, unpaidLeaves] = await Promise.all([
        this.prisma.employee.findMany({ 
          where: { 
            isActive: true,
            tenantId: contextTenantId 
          } 
        }),
        this.prisma.taxSlab.findMany({ 
          where: { tenantId: contextTenantId },
          orderBy: { minIncome: 'asc' } 
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            tenantId: contextTenantId,
            status: 'APPROVED',
            leaveType: 'UNPAID',
            startDate: { lte: endDate },
            endDate: { gte: startDate }
          }
        })
      ]);

      const payslipsData = employees.map((emp) => {
        let grossSalaryNum = emp.salary ? Number(emp.salary.toString()) : 0;

        // Deduction for unpaid leave
        const empUnpaidLeaves = unpaidLeaves.filter(l => l.employeeId === emp.id);
        let unpaidDays = 0;
        for (const leave of empUnpaidLeaves) {
          const lStart = new Date(Math.max(leave.startDate.getTime(), startDate.getTime()));
          const lEnd = new Date(Math.min(leave.endDate.getTime(), endDate.getTime()));
          
          const current = new Date(lStart);
          while (current <= lEnd) {
            if (current.getDay() !== 0 && current.getDay() !== 6) {
              if (leave.isHalfDay && leave.startDate.toDateString() === leave.endDate.toDateString()) {
                unpaidDays += 0.5;
              } else {
                unpaidDays += 1;
              }
            }
            current.setDate(current.getDate() + 1);
          }
        }

        if (unpaidDays > 0) {
          const dailyRate = grossSalaryNum / 30; // standard month divisor
          grossSalaryNum -= (dailyRate * unpaidDays);
          if (grossSalaryNum < 0) grossSalaryNum = 0;
        }

        let tax = 0;
        
        // Progressive tax calculation:
        // We loop through each slab and calculate the tax for the portion of income that falls into it.
        for (const slab of taxSlabs) {
          if (grossSalaryNum >= slab.minIncome) {
            const slabMax = slab.maxIncome || Number.MAX_SAFE_INTEGER;
            const taxableAmountInSlab = Math.min(grossSalaryNum, slabMax) - slab.minIncome;
            
            if (taxableAmountInSlab > 0) {
              tax += (taxableAmountInSlab * (slab.rate / 100));
            }
          }
        }
        
        // AI FIX: The previous logic redundantly added fixedAmount on top of progressive calculation.
        // If the system uses fixedAmount + (income - min) * rate, it should NOT use the loop.
        // If the system uses a progressive loop, fixedAmount should be 0 or handled differently.
        // Based on the mandate, we ensure fixedAmount isn't added redundantly.
        // If fixedAmount is intended to be the sum of previous slabs, the loop already covers it.

        return {
          runId,
          employeeId: emp.id,
          grossSalary: grossSalaryNum,
          netSalary: grossSalaryNum - tax,
          taxDeduction: tax,
          status: PayslipStatus.DRAFT,
          tenantId: contextTenantId,
        };
      });

      // Use a transaction for the bulk operation and status update
      await this.prisma.$transaction(async (tx) => {
        // Bulk create payslips
        if (payslipsData.length > 0) {
          await tx.payslip.createMany({
            data: payslipsData,
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

  async payRun(id: string, currentUser: CurrentUserData) {
    const tenantId = tenantContextStorage.getStore()?.tenantId;
    
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({
        where: { id },
        include: { payslips: true },
      });

      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.status !== PayrollStatus.APPROVED) {
        throw new BadRequestException('Payroll run must be APPROVED before payment');
      }

      const totalNetSalary = run.payslips.reduce((sum, p) => sum + Number(p.netSalary), 0);
      
      if (totalNetSalary > 0) {
        // 1. Find or create accounts
        let expenseAccount = await tx.account.findFirst({
          where: { code: '5200', tenantId },
        });
        
        if (!expenseAccount) {
          expenseAccount = await tx.account.create({
            data: {
              code: '5200',
              name: 'Payroll Expense',
              type: 'EXPENSE',
              tenantId: tenantId!,
            },
          });
        }

        let cashAccount = await tx.account.findFirst({
          where: { code: '1000', tenantId },
        });

        if (!cashAccount) {
          throw new BadRequestException('Cash/Bank account (1000) not found');
        }

        // 2. Generate Journal Entry
        await this.financeService.createJournalEntry({
          date: new Date(),
          description: `Payroll Payment for period ${run.period}`,
          reference: `PAYROLL-${run.id}`,
          lines: [
            {
              accountId: expenseAccount.id,
              debit: totalNetSalary,
              description: `Payroll Expense ${run.period}`,
            },
            {
              accountId: cashAccount.id,
              credit: totalNetSalary,
              description: `Payroll Cash Payout ${run.period}`,
            },
          ],
        }, currentUser);
      }

      // 3. Update status
      await tx.payrollRun.update({
        where: { id },
        data: { status: PayrollStatus.PAID },
      });

      await tx.payslip.updateMany({
        where: { runId: id },
        data: { status: PayslipStatus.PAID },
      });

      return { success: true };
    });
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
      include: { 
        employee: {
          include: {
            department: true
          }
        }, 
        run: true,
        tenant: true
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    return payslip;
  }

  async generatePayslipPdf(payslipId: string): Promise<Buffer> {
    const payslip = await this.getPayslip(payslipId);
    const { employee, run, tenant } = payslip;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: any[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Company Info from Tenant Model
      doc.fontSize(20).text(tenant.name.toUpperCase(), { align: 'center' });
      if (tenant.address) {
        doc.fontSize(10).text(tenant.address, { align: 'center' });
      }
      doc.moveDown(2);

      // Payslip Header
      doc.fontSize(16).text('PAYSLIP', { align: 'center', underline: true });
      doc.moveDown();

      // Employee and Period Info
      const startX = 50;
      let currentY = doc.y;

      doc.fontSize(10).font('Helvetica-Bold').text('Employee Details', startX, currentY);
      doc.font('Helvetica').text(`Name: ${employee.firstName} ${employee.lastName}`, startX, currentY + 15);
      doc.text(`Employee Code: ${employee.employeeCode}`, startX, currentY + 30);
      doc.text(`Department: ${employee.department?.name || 'N/A'}`, startX, currentY + 45);

      const periodX = 350;
      doc.font('Helvetica-Bold').text('Payroll Period', periodX, currentY);
      doc.font('Helvetica').text(`Month: ${run.period}`, periodX, currentY + 15);
      doc.text(`Status: ${payslip.status}`, periodX, currentY + 30);
      doc.text(`Currency: ${run.currency}`, periodX, currentY + 45);

      doc.moveDown(4);
      currentY = doc.y;

      // Draw a line
      doc.moveTo(startX, currentY).lineTo(550, currentY).stroke();
      doc.moveDown();

      // Salary Details Table-like structure
      currentY = doc.y;
      doc.font('Helvetica-Bold').text('Description', startX, currentY);
      doc.text('Amount', 450, currentY, { align: 'right' });
      
      doc.moveDown();
      doc.font('Helvetica');
      doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      currentY = doc.y;
      doc.text('Gross Salary', startX, currentY);
      doc.text(`${run.currency} ${Number(payslip.grossSalary).toFixed(2)}`, 450, currentY, { align: 'right' });
      doc.moveDown();

      // Deductions
      doc.font('Helvetica-Bold').text('Deductions', startX, doc.y);
      doc.moveDown(0.5);
      doc.font('Helvetica');
      
      currentY = doc.y;
      doc.text('Income Tax', startX, currentY);
      doc.text(`- ${run.currency} ${Number(payslip.taxDeduction).toFixed(2)}`, 450, currentY, { align: 'right' });
      doc.moveDown();

      doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Net Salary
      currentY = doc.y;
      doc.font('Helvetica-Bold').fontSize(12).text('NET SALARY', startX, currentY);
      doc.text(`${run.currency} ${Number(payslip.netSalary).toFixed(2)}`, 450, currentY, { align: 'right' });

      doc.moveDown(4);
      doc.fontSize(10).font('Helvetica-Oblique').text('This is a computer generated document and does not require a signature.', { align: 'center' });

      doc.end();
    });
  }

  async getTaxSlabs(tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    return this.prisma.taxSlab.findMany({ 
      where: { tenantId: contextTenantId },
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

  async updateTaxSlab(id: string, data: { min: number; max: number; rate: number; fixed: number }, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    const slab = await this.prisma.taxSlab.findUnique({ where: { id } });

    if (!slab || slab.tenantId !== contextTenantId) {
      throw new NotFoundException('Tax slab not found');
    }

    return this.prisma.taxSlab.update({
      where: { id },
      data: {
        minIncome: data.min,
        maxIncome: data.max,
        rate: data.rate,
        fixedAmount: data.fixed,
      },
    });
  }

  async deleteTaxSlab(id: string, tenantId: string) {
    const contextTenantId = tenantContextStorage.getStore()?.tenantId || tenantId;
    const slab = await this.prisma.taxSlab.findUnique({ where: { id } });

    if (!slab || slab.tenantId !== contextTenantId) {
      throw new NotFoundException('Tax slab not found');
    }

    await this.prisma.taxSlab.delete({ where: { id } });
    return { success: true };
  }
}
