import { Controller, Post, Get, UseGuards, Res, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Response } from 'express';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('viewer')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.attendanceService.findAll(currentUser);
  }

  @Get('status')
  getStatus(@CurrentUser() currentUser: CurrentUserData) {
    return this.attendanceService.getStatus(currentUser);
  }

  @Post('clock-in')
  clockIn(@CurrentUser() currentUser: CurrentUserData) {
    return this.attendanceService.clockIn(currentUser);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() currentUser: CurrentUserData) {
    return this.attendanceService.clockOut(currentUser);
  }

  @Get('export')
  async exportReport(
    @Res() res: Response,
    @Query('employeeId') employeeId: string,
    @Query('month') month: string,
    @CurrentUser() currentUser: CurrentUserData
  ) {
    const pdfBuffer = await this.attendanceService.exportReport(employeeId, month);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=attendance_${employeeId}_${month}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
