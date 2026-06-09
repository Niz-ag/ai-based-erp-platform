import { Controller, Get, Post, Put, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreatePurchaseOrderLineDto {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface CreatePurchaseOrderDto {
  vendorId: string;
  expectedDate?: string;
  notes?: string;
  lines: CreatePurchaseOrderLineDto[];
}

interface ReceiveLineDto {
  lineId: string;
  receivedQty: number;
}

interface ReceivePurchaseOrderDto {
  items: ReceiveLineDto[];
}

interface ReturnLineDto {
  lineId: string;
  returnQty: number;
}

interface ReturnPurchaseOrderDto {
  items: ReturnLineDto[];
}

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.purchaseOrdersService.findAll(currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.purchaseOrdersService.create(createPurchaseOrderDto, currentUser);
  }

  @Put(':id/approve')
  @Roles('superadmin', 'admin', 'manager')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.purchaseOrdersService.approve(id, currentUser);
  }

  @Put(':id/receive')
  @Roles('superadmin', 'admin', 'manager')
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() receiveDto: ReceivePurchaseOrderDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.purchaseOrdersService.receive(id, receiveDto, currentUser);
  }

  @Put(':id/return')
  @Roles('superadmin', 'admin', 'manager')
  returnItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() returnDto: ReturnPurchaseOrderDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.purchaseOrdersService.returnItems(id, returnDto, currentUser);
  }
}