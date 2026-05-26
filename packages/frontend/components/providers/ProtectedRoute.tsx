"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { navigation, roleHierarchy } from "@/components/layout/Sidebar";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const publicPaths = ["/login"];
    const isPublicPath = publicPaths.includes(pathname);
    
    if (!isAuthenticated && !isPublicPath) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    } 
    
    if (isAuthenticated && pathname === "/login") {
      router.push("/dashboard");
      return;
    }

    if (isAuthenticated && user) {
      // Find navigation item matching current path
      const navItem = navigation.find(item => pathname.startsWith(item.href));
      if (navItem) {
        const userLevel = roleHierarchy[user.role.toLowerCase() as keyof typeof roleHierarchy] ?? 0;
        const requiredLevel = roleHierarchy[navItem.minRole.toLowerCase() as keyof typeof roleHierarchy] ?? 0;
        
        if (userLevel < requiredLevel) {
          toast.error("Access Denied", { description: "You don't have permission to access this page." });
          router.push("/dashboard");
        }
      }
    }
  }, [isAuthenticated, user, router, pathname]);

  // Show loading if checking auth
  if (!isAuthenticated && pathname !== "/login") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}