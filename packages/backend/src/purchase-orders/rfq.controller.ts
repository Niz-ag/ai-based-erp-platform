import { Controller, Get, Post, Body, Param, Put, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RFQService } from './rfq.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('rfqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RFQController {
  constructor(private readonly rfqService: RFQService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.rfqService.findAll(user);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserData) {
    return this.rfqService.findOne(id, user);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(@Body() data: any, @CurrentUser() user: CurrentUserData) {
    return this.rfqService.create(data, user);
  }

  @Post(':id/convert')
  @Roles('superadmin', 'admin', 'manager')
  convertToPO(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserData) {
    return this.rfqService.convertToPO(id, user);
  }
}
