import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseUUIDPipe, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roleId: string;
}

interface UpdateUserDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  isActive?: boolean;
  theme?: string;
  language?: string;
  notificationPreferences?: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    inAppEnabled?: boolean;
    notifyOnLeaveRequest?: boolean;
    notifyOnPurchaseOrder?: boolean;
    notifyOnInventory?: boolean;
    notifyOnSystem?: boolean;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  private roleHierarchy: Record<string, number> = {
    'superadmin': 5,
    'admin': 4,
    'manager': 3,
    'viewer': 2,
    'user': 1,
  };

  @Get()
  @Roles('admin', 'superadmin', 'viewer')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.findAll(currentUser);
  }

  @Get('roles')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  @Get(':id')
  @Roles('admin', 'superadmin', 'viewer')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.findOne(id, currentUser);
  }

  @Post()
  @Roles('admin', 'superadmin')
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    // Role Hierarchy Check
    const userRole = currentUser.role?.name?.toLowerCase() || 'user';
    const userLevel = this.roleHierarchy[userRole] || 0;

    const allRoles = await this.usersService.findAllRoles();
    const targetRole = allRoles.find(r => r.id === createUserDto.roleId);
    
    if (!targetRole) {
      throw new NotFoundException('Target role not found');
    }

    const targetLevel = this.roleHierarchy[targetRole.name.toLowerCase()] || 0;

    if (targetLevel > userLevel) {
      throw new ForbiddenException(`Security violation: Cannot assign role '${targetRole.name}' which is higher than your own role.`);
    }

    return this.usersService.create(
      {
        email: createUserDto.email,
        passwordHash: createUserDto.password,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: { connect: { id: createUserDto.roleId } },
      } as any,
      currentUser,
    );
  }

  @Put(':id')
  @Roles('admin', 'superadmin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    const updateData: any = {};
    if (updateUserDto.email) updateData.email = updateUserDto.email;
    if (updateUserDto.password) updateData.passwordHash = updateUserDto.password;
    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined) updateData.isActive = updateUserDto.isActive;
    if (updateUserDto.theme) updateData.theme = updateUserDto.theme;
    if (updateUserDto.language) updateData.language = updateUserDto.language;
    if (updateUserDto.notificationPreferences) {
      updateData.notificationPreference = updateUserDto.notificationPreferences;
    }

    // Role Hierarchy Check for updates
    if (updateUserDto.roleId) {
      const userRole = currentUser.role?.name?.toLowerCase() || 'user';
      const userLevel = this.roleHierarchy[userRole] || 0;

      const allRoles = await this.usersService.findAllRoles();
      const targetRole = allRoles.find(r => r.id === updateUserDto.roleId);
      
      if (!targetRole) {
        throw new NotFoundException('Target role not found');
      }

      const targetLevel = this.roleHierarchy[targetRole.name.toLowerCase()] || 0;

      if (targetLevel > userLevel) {
        throw new ForbiddenException(`Security violation: Cannot update user to role '${targetRole.name}' which is higher than your own role.`);
      }
      
      updateData.role = { connect: { id: updateUserDto.roleId } };
    }

    return this.usersService.update(id, updateData, currentUser);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.remove(id, currentUser);
  }
}