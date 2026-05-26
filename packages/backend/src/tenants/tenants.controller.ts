import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

class CreateTenantDto {
  name!: string;
  domain?: string;
}

class UpdateTenantDto {
  name?: string;
  domain?: string;
  isActive?: boolean;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get()
  @Roles('superadmin')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.tenantsService.findAll(currentUser);
  }

  @Get(':id')
  @Roles('superadmin')
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.tenantsService.findOne(id, currentUser);
  }

  @Post()
  @Roles('superadmin')
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto as any);
  }

  @Put(':id')
  @Roles('superadmin')
  update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.tenantsService.update(id, updateTenantDto as any, currentUser);
  }

  @Delete(':id')
  @Roles('superadmin')
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.tenantsService.delete(id, currentUser);
  }
}