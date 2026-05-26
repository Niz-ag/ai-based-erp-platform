"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Settings,
  DollarSign,
  Briefcase,
  Package,
  FolderKanban,
  Bell,
  X,
  BarChart3,
  Calculator,
  ScrollText,
  Webhook,
  FileText,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/useAuthStore";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Role-based navigation config per api_endpoints.md
// viewer: can read
// manager: can create/update (includes viewer permissions)
// admin: user management, all CRUD (includes manager permissions)
// superadmin: tenant management (includes admin permissions)
export const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: "user" },
  { name: "Dashboard Builder", href: "/dashboard/builder", icon: BarChart3, minRole: "manager" },
  { name: "Finance", href: "/finance", icon: DollarSign, minRole: "user" },
  { name: "HR", href: "/hr", icon: Users, minRole: "manager" },
  { name: "Inventory", href: "/inventory", icon: Package, minRole: "manager" },
  { name: "Supply Chain", href: "/supply-chain", icon: Truck, minRole: "manager" },
  { name: "Projects", href: "/projects", icon: FolderKanban, minRole: "user" },
  { name: "Payroll", href: "/payroll", icon: Calculator, minRole: "manager" },
  { name: "Audit Logs", href: "/audit", icon: ScrollText, minRole: "user" },
  { name: "Webhooks", href: "/webhooks", icon: Webhook, minRole: "manager" },
  { name: "Reports", href: "/reports", icon: FileText, minRole: "viewer" },
  { name: "Notifications", href: "/notifications", icon: Bell, minRole: "viewer" },
  { name: "Tenants", href: "/tenants", icon: Building2, minRole: "superadmin" },
  { name: "Users", href: "/users", icon: Users, minRole: "admin" },
  { name: "Settings", href: "/settings", icon: Settings, minRole: "admin" },
];

// Role hierarchy for comparison
export const roleHierarchy: Record<string, number> = {
  user: 0,      // lowest - can only see basics
  viewer: 1,
  manager: 2,
  admin: 3,
  superadmin: 4,
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Default to viewer level (1) if role not in hierarchy
  const currentUserRoleLevel = roleHierarchy[user?.role as keyof typeof roleHierarchy] || 1;
  
  // Filter navigation items based on user role hierarchy
  // Users see menu items equal to or below their role level
  const filteredNav = navigation.filter(item => {
    const requiredRoleLevel = roleHierarchy[item.minRole as keyof typeof roleHierarchy] || 1;
    return currentUserRoleLevel >= requiredRoleLevel;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-background border-r transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b lg:h-16">
          <span className="font-bold text-lg">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}