import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  unitPrice: number;
  unit?: string;
  vendorId?: string;
  reorderThreshold?: number;
}

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.productsService.findAll(currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.productsService.create(createProductDto, currentUser);
  }
}