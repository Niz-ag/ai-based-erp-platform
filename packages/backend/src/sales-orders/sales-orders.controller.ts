import { Controller, Get, Post, Body, Param, Put, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { SalesOrderStatus } from '@prisma/client';

@Controller('sales-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'user')
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.salesOrdersService.findAll(user);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'user')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserData) {
    return this.salesOrdersService.findOne(id, user);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(@Body() data: any, @CurrentUser() user: CurrentUserData) {
    return this.salesOrdersService.create(data, user);
  }

  @Put(':id/status')
  @Roles('superadmin', 'admin', 'manager')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: SalesOrderStatus,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.salesOrdersService.updateStatus(id, status, user);
  }
}
