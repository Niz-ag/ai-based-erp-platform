import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.inventoryService.findAll(currentUser);
  }

  @Get('low-stock')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findLowStock(@CurrentUser() currentUser: CurrentUserData) {
    return this.inventoryService.findLowStock(currentUser);
  }

  @Post(':id/adjust')
  @Roles('superadmin', 'admin', 'manager')
  adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { quantity: number; notes?: string },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.inventoryService.adjust(id, data, currentUser);
  }
}