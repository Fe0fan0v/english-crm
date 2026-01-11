import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";
import { authApi } from "../services/api";

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
          const token = response.access_token;

          // Save token to localStorage and state
          localStorage.setItem("token", token);
          set({ token });
        } catch (error) {
          localStorage.removeItem("token");
          set({ token: null, user: null });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        // Clear all auth data
        localStorage.removeItem("token");
        localStorage.removeItem("auth-storage");
        set({ token: null, user: null });
      },

      fetchUser: async () => {
        const token = get().token || localStorage.getItem("token");
        if (!token) {
          set({ user: null });
          return;
        }

        try {
          const user = await authApi.me();
          set({ user });
        } catch {
          // Don't clear token here - let the component handle redirect
          set({ user: null });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
