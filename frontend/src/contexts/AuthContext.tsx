import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface Restaurant {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  restaurant: Restaurant;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  loginWithCode: (
    email: string,
    challengeId: string,
    code: string,
    remember?: boolean
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      setUser(null);
      return;
    }
    const me = await api<User>('/api/auth/me');
    setUser(me);
  }

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser()
      .catch(() => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, remember = true) {
    const res = await api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    acceptSession(res, remember);
  }

  function acceptSession(res: { token: string; user: User }, remember: boolean) {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    if (remember) localStorage.setItem('token', res.token);
    else sessionStorage.setItem('token', res.token);
    setUser(res.user);
  }

  async function loginWithCode(email: string, challengeId: string, code: string, remember = true) {
    const res = await api<{ token: string; user: User }>('/api/auth/login/code/verify', {
      method: 'POST',
      body: JSON.stringify({ email, challengeId, code }),
    });
    acceptSession(res, remember);
  }

  function logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithCode, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
