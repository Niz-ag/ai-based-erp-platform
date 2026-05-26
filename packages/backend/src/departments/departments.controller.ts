import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreateDepartmentDto {
  name: string;
  description?: string;
  managerId?: string;
}

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.departmentsService.findAll(currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() createDepartmentDto: CreateDepartmentDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.departmentsService.create(createDepartmentDto, currentUser);
  }
}