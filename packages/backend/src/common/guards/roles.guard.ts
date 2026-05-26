import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  // Role hierarchy: higher roles include lower role permissions
  private roleHierarchy: Record<string, number> = {
    'superadmin': 4,
    'admin': 3,
    'manager': 2,
    'user': 1,
  };

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      return false;
    }

    // Handle role as string or role object with name property
    let userRole: string;
    if (typeof user.role === 'string') {
      userRole = user.role.toLowerCase();
    } else if (user.role && typeof user.role === 'object' && user.role.name) {
      userRole = user.role.name.toLowerCase();
    } else {
      return false;
    }

    // Get user's role level (default to 0 if not found)
    const userLevel = this.roleHierarchy[userRole] || 0;

    // Check if user has ANY of the required roles (or higher role in hierarchy)
    return requiredRoles.some(requiredRole => {
      const requiredLevel = this.roleHierarchy[requiredRole] || 0;
      return userLevel >= requiredLevel;
    });
  }
}