import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreateVendorDto {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
}

@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.vendorsService.findAll(currentUser);
  }

  @Get(':id')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserData) {
    return this.vendorsService.findOne(id, currentUser);
  }

  @Get(':id/performance')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  getPerformance(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserData) {
    return this.vendorsService.getPerformance(id, currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() createVendorDto: CreateVendorDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.vendorsService.create(createVendorDto, currentUser);
  }
}