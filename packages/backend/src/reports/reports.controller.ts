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
  findAll() {
    return this.reportsService.findAll();
  }

  @Post('generate')
  @Roles('superadmin', 'admin', 'manager')
  generate(
    @Body() body: { type: string }
  ) {
    return this.reportsService.generate(body.type);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findOne(
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.reportsService.findOne(id);
  }

  @Get(':id/download')
  @Roles('superadmin', 'admin', 'manager')
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: 'pdf' | 'excel'
  ) {
    return this.reportsService.generateDownload(id, format);
  }
}