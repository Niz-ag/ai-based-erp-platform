import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getStats(@CurrentUser() currentUser: CurrentUserData) {
    return this.dashboardService.getStats(currentUser);
  }

  @Get('recent-activity')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getRecentActivity(@CurrentUser() currentUser: CurrentUserData) {
    return this.dashboardService.getRecentActivity(currentUser);
  }

  @Get('layout')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getLayout(@CurrentUser() currentUser: CurrentUserData) {
    return this.dashboardService.getLayout(currentUser);
  }

  @Post('layout')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  saveLayout(@CurrentUser() currentUser: CurrentUserData, @Body() body: { layout: any }) {
    return this.dashboardService.saveLayout(currentUser, body.layout);
  }
}
