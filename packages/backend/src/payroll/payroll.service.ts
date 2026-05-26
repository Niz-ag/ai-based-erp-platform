import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PayrollStatus, PayslipStatus } from '@prisma/client';
import { CurrentUserData } from '../common/decorators/current-user.decorator';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async getRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async createRun(period: string, currency: string, tenantId: string) {
    // Get all employees for this tenant
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, tenantId },
    });

    const run = await this.prisma.payrollRun.create({
      data: {
        period,
        currency,
        status: PayrollStatus.DRAFT,
        totalEmployees: employees.length,
        tenantId,
      },
    });

    // Create payslips for each employee
    const taxSlabs = await this.prisma.taxSlab.findMany({
      where: { tenantId },
      orderBy: { minIncome: 'asc' },
    });

    for (const emp of employees) {
      const grossSalaryNum = emp.salary ? Number(emp.salary.toString()) : 0;
      let tax = 0;
      
      // Calculate tax based on slabs
      for (const slab of taxSlabs) {
        if (grossSalaryNum >= slab.minIncome) {
          const maxIncome = slab.maxIncome || grossSalaryNum;
          const taxableInSlab = Math.min(grossSalaryNum, maxIncome) - slab.minIncome;
          tax += taxableInSlab * (slab.rate / 100) + slab.fixedAmount;
        }
      }

      await this.prisma.payslip.create({
        data: {
          runId: run.id,
          employeeId: emp.id,
          grossSalary: grossSalaryNum,
          netSalary: grossSalaryNum - tax,
          taxDeduction: tax,
          status: PayslipStatus.DRAFT,
          tenantId,
        },
      });
    }

    return run;
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
      where: { tenantId },
      orderBy: { minIncome: 'asc' } 
    });
  }

  async createTaxSlab(data: { min: number; max: number; rate: number; fixed: number }, tenantId: string) {
    return this.prisma.taxSlab.create({
      data: {
        minIncome: data.min,
        maxIncome: data.max,
        rate: data.rate,
        fixedAmount: data.fixed,
        tenantId,
      },
    });
  }
}