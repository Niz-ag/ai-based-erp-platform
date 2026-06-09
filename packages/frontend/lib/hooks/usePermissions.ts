import { useAuthStore } from '../store/useAuthStore';

/**
 * AI MANDATE: Unified Permission Logic
 * This hook provides a single source of truth for permission checks across the frontend.
 * It integrates with useAuthStore to access the current user's role and permissions.
 */
export const usePermissions = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string | string[]): boolean => {
    if (!user || !user.role) return false;

    // Superadmins and Admins bypass all permission checks
    const roleName = user.role.name.toLowerCase();
    if (roleName === 'superadmin' || roleName === 'admin') return true;

    let userPermissions = user.role.permissions || [];
    if (typeof userPermissions === 'string') {
      try { userPermissions = JSON.parse(userPermissions); } catch (e) { userPermissions = []; }
    }
    
    if (userPermissions.includes('all') || userPermissions.includes('*')) return true;

    if (Array.isArray(permission)) {
      return permission.every((p) => userPermissions.includes(p));
    }

    return userPermissions.includes(permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user || !user.role) return false;

    // Superadmins and Admins bypass all permission checks
    const roleName = user.role.name.toLowerCase();
    if (roleName === 'superadmin' || roleName === 'admin') return true;

    let userPermissions = user.role.permissions || [];
    if (typeof userPermissions === 'string') {
      try { userPermissions = JSON.parse(userPermissions); } catch (e) { userPermissions = []; }
    }
    
    if (userPermissions.includes('all') || userPermissions.includes('*')) return true;

    return permissions.some((p) => userPermissions.includes(p));
  };

  return {
    hasPermission,
    hasAnyPermission,
    permissions: user?.role?.permissions || [],
    role: user?.role?.name,
  };
};
