import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

class InventoryAdjustDto {
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  reasonCode: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

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
    @Body() data: InventoryAdjustDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.inventoryService.adjust(id, data, currentUser);
  }

  @Get('product/:productId/history')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getSkuHistory(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.inventoryService.getSkuHistory(productId, currentUser);
  }

  @Get('search/:query')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  searchByBarcodeOrSku(
    @Param('query') query: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.inventoryService.findByBarcodeOrSku(query, currentUser);
  }

  @Post('transfer')
  @Roles('superadmin', 'admin', 'manager')
  transfer(
    @Body() data: { productId: string, fromLocation: string, toLocation: string, quantity: number, notes?: string },
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.inventoryService.transfer(data, currentUser);
  }
}