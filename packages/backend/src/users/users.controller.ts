import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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
  isActive?: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('admin', 'superadmin')
  findAll(@CurrentUser() currentUser: CurrentUserData) {
    return this.usersService.findAll(currentUser);
  }

  @Get('roles')
  @Roles('superadmin', 'admin', 'manager', 'viewer')
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  @Get(':id')
  @Roles('admin', 'superadmin')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.findOne(id, currentUser);
  }

  @Post()
  @Roles('admin', 'superadmin')
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
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
  update(
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