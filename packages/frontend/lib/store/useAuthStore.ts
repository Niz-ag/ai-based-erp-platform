import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

/**
 * AI MANDATE: Centralized State Management (Phase 1)
 * This store now utilizes the master User definition from lib/types.ts
 * to ensure 100% type-safety across the application.
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: User) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: (state) => {
        return () => state?.setHydrated();
      },
    }
  )
);
