import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe, Res, Patch, Delete } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Response } from 'express';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('runs')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getRuns(@CurrentUser() currentUser: CurrentUserData) {
    return this.payrollService.getRuns(currentUser.tenantId);
  }

  @Post('runs')
  @Roles('superadmin', 'admin', 'manager')
  createRun(
    @Body() body: { period: string; currency: string },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.payrollService.createRun(body.period, body.currency, currentUser.tenantId);
  }

  @Get('runs/:id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.getRun(id);
  }

  @Post('runs/:id/approve')
  @Roles('superadmin', 'admin', 'manager')
  approveRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.approveRun(id);
  }

  @Post('runs/:id/pay')
  @Roles('superadmin', 'admin', 'manager')
  payRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.payrollService.payRun(id, currentUser);
  }

  @Get('runs/:id/payslips')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getPayslips(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.getPayslips(id);
  }

  @Get('payslips/:id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getPayslip(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollService.getPayslip(id);
  }

  @Get('payslips/:id/download')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  async downloadPayslip(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.payrollService.generatePayslipPdf(id);
    const payslip = await this.payrollService.getPayslip(id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=payslip-${payslip.employee.employeeCode}-${payslip.run.period}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('tax-slabs')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getTaxSlabs(@CurrentUser() currentUser: CurrentUserData) {
    return this.payrollService.getTaxSlabs(currentUser.tenantId);
  }

  @Post('tax-slabs')
  @Roles('superadmin', 'admin', 'manager')
  createTaxSlab(
    @Body() body: { min: number; max: number; rate: number; fixed: number },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.payrollService.createTaxSlab(body, currentUser.tenantId);
  }

  @Patch('tax-slabs/:id')
  @Roles('superadmin', 'admin', 'manager')
  updateTaxSlab(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { min: number; max: number; rate: number; fixed: number },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.payrollService.updateTaxSlab(id, body, currentUser.tenantId);
  }

  @Delete('tax-slabs/:id')
  @Roles('superadmin', 'admin')
  deleteTaxSlab(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.payrollService.deleteTaxSlab(id, currentUser.tenantId);
  }
}
