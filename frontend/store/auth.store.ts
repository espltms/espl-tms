import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => {
  // Safe SSR checking for window object
  const isClient = typeof window !== 'undefined';
  const savedToken = isClient ? localStorage.getItem('tms_token') : null;
  const savedUser = isClient ? localStorage.getItem('tms_user') : null;

  let initialUser: User | null = null;
  if (savedUser) {
    try {
      initialUser = JSON.parse(savedUser);
    } catch {
      initialUser = null;
    }
  }

  return {
    user: initialUser,
    token: savedToken,
    isAuthenticated: !!savedToken,
    login: (user, token) => {
      if (isClient) {
        localStorage.setItem('tms_token', token);
        localStorage.setItem('tms_user', JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      if (isClient) {
        localStorage.removeItem('tms_token');
        localStorage.removeItem('tms_user');
      }
      set({ user: null, token: null, isAuthenticated: false });
    },
  };
});
