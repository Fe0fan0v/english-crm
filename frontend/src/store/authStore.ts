import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login({ email, password });
          localStorage.setItem('token', response.access_token);
          set({ token: response.access_token });
          await get().fetchUser();
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      },

      fetchUser: async () => {
        try {
          const user = await authApi.me();
          set({ user });
        } catch {
          set({ token: null, user: null });
          localStorage.removeItem('token');
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
