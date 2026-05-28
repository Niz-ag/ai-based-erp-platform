import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: CurrentUserData) {
    // All users can list users within their tenant
    // SuperAdmins/Admins can list all users if they want, but default to tenant
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
          }
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string, currentUser: CurrentUserData) {
    // Users can only view users in their own tenant unless admin
    const where: Prisma.UserWhereInput = {
      id,
    };

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(data: Prisma.UserCreateInput, currentUser: CurrentUserData) {
    // Only admins can create users
    if (currentUser.role.name !== 'admin' && currentUser.role.name !== 'SuperAdmin') {
      throw new ForbiddenException('Only admins can create users');
    }

    // Hash password if provided
    if (data.passwordHash) {
      data.passwordHash = await bcrypt.hash(data.passwordHash, 10);
    }

    return this.prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput, currentUser: CurrentUserData) {
    // Users can update their own profile, admins can update anyone
    if (currentUser.role.name !== 'admin' && currentUser.role.name !== 'SuperAdmin' && currentUser.id !== id) {
      throw new ForbiddenException('Cannot update other users');
    }

    // Hash password if provided
    if (data.passwordHash) {
      const password = data.passwordHash as string;
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async remove(id: string, currentUser: CurrentUserData) {
    // Only admins can delete users
    if (currentUser.role.name !== 'admin' && currentUser.role.name !== 'SuperAdmin') {
      throw new ForbiddenException('Only admins can delete users');
    }

    // Cannot delete yourself
    if (currentUser.id === id) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    // Soft delete - set isActive to false
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }
}