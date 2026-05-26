import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.webhooksService.getAll(currentUser.tenantId);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() body: { url: string; events: string[]; secret?: string },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.webhooksService.create(body, currentUser.tenantId);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.getOne(id);
  }

  @Patch(':id')
  @Roles('superadmin', 'admin', 'manager')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { url?: string; events?: string[]; isActive?: boolean },
  ) {
    return this.webhooksService.update(id, body);
  }

  @Delete(':id')
  @Roles('superadmin', 'admin', 'manager')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.delete(id);
  }

  @Post(':id/test')
  @Roles('superadmin', 'admin', 'manager')
  test(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.testWebhook(id);
  }

  @Get(':id/deliveries')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getDeliveries(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.getDeliveries(id);
  }
}