import { Controller, Get, Post, Param, Body, UseGuards, Query, ParseUUIDPipe, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Response } from 'express';

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

  @Post('schedule')
  @Roles('superadmin', 'admin', 'manager')
  schedule(
    @Body() body: { type: string, schedule: string }
  ) {
    return this.reportsService.schedule(body.type, body.schedule);
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
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response
  ) {
    const { content, filename } = await this.reportsService.getReportFile(id);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}