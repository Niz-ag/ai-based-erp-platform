import { Controller, Get, Post, Param, Body, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.reportsService.findAll(currentUser.tenantId);
  }

  @Post('generate')
  @Roles('superadmin', 'admin', 'manager')
  generate(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() body: { type: string }
  ) {
    return this.reportsService.generate(currentUser.tenantId, body.type);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findOne(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.reportsService.findOne(currentUser.tenantId, id);
  }

  @Get(':id/download')
  @Roles('superadmin', 'admin', 'manager')
  download(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: 'pdf' | 'excel'
  ) {
    return this.reportsService.generateDownload(currentUser.tenantId, id, format);
  }
}