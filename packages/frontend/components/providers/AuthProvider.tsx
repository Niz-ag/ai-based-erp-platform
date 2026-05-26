"use client";

import React from "react";
import { useAuthStore } from "@/lib/store/useAuthStore";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Auth state is managed by Zustand store with persist middleware
  // The store is initialized automatically when accessed
  return <>{children}</>;
}