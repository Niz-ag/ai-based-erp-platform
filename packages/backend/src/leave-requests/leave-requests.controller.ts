import { Controller, Get, Post, Put, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreateLeaveRequestDto {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

@Controller('leave-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveRequestsController {
  constructor(private leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.leaveRequestsService.findAll(currentUser);
  }

  @Get('employee/:employeeId')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.leaveRequestsService.findByEmployee(employeeId, currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.leaveRequestsService.create(createLeaveRequestDto, currentUser);
  }

  @Put(':id/approve')
  @Roles('superadmin', 'admin', 'manager')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.leaveRequestsService.approve(id, currentUser);
  }

  @Put(':id/reject')
  @Roles('superadmin', 'admin', 'manager')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.leaveRequestsService.reject(id, currentUser);
  }

  @Get('balances')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getMyBalances(@CurrentUser() currentUser: CurrentUserData) {
    return this.leaveRequestsService.getMyLeaveBalances(currentUser);
  }

  @Get('balances/:employeeId')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getBalances(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.leaveRequestsService.getLeaveBalances(employeeId, currentUser);
  }
}