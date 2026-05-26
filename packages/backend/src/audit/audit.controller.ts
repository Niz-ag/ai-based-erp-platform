import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getLogs(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    return this.auditService.getLogs(currentUser.tenantId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      action,
      userId,
    });
  }

  @Get('logs/export')
  @Roles('superadmin', 'admin')
  exportLogs(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.exportLogs(currentUser.tenantId, { from, to });
  }
}