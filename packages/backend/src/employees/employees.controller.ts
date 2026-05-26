import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreateEmployeeDto {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hireDate?: string;
  position?: string;
  salary?: number;
  departmentId?: string;
}

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.employeesService.findAll(currentUser);
  }

  @Post()
  @Roles('superadmin', 'admin', 'manager')
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.employeesService.create(createEmployeeDto, currentUser);
  }
}