import React from 'react';
import { usePermissions } from '../../lib/hooks/usePermissions';

interface PermissionGuardProps {
  permissions: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  mode?: 'hide' | 'disable';
}

/**
 * AI MANDATE: Permission-Based UI Control
 * This component guards its children based on the user's permissions.
 * 'hide' mode (default) will not render children if permission is missing.
 * 'disable' mode will clone the child and inject the 'disabled' prop.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permissions,
  children,
  fallback = null,
  mode = 'hide',
}) => {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(permissions);

  if (allowed) {
    return <>{children}</>;
  }

  if (mode === 'disable') {
    return (
      <>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            const element = child as React.ReactElement<any>;
            // Check if it's a component that typically accepts a disabled prop
            // or if we just want to force it.
            return React.cloneElement(element, {
              disabled: true,
              title: "You don't have permission to perform this action",
              className: `${element.props.className || ''} opacity-50 cursor-not-allowed`,
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
              }
            });
          }
          return child;
        })}
      </>
    );
  }

  return <>{fallback}</>;
};
