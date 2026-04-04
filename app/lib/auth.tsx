"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson } from './api';

interface User {
  id: string;
  displayName: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const clearStoredSession = () => {
      localStorage.removeItem('chocks_token');
      localStorage.removeItem('chocks_user');
      if (!cancelled) {
        setToken(null);
        setUser(null);
      }
    };

    const restoreSession = async () => {
      const savedToken = localStorage.getItem('chocks_token');
      const savedUser = localStorage.getItem('chocks_user');

      if (!savedToken || !savedUser) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        const data = await requestJson('/auth/me');

        if (cancelled) return;

        setToken(savedToken);
        setUser(data?.user ?? parsedUser);
        localStorage.setItem('chocks_user', JSON.stringify(data?.user ?? parsedUser));
      } catch {
        clearStoredSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await requestJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('chocks_token', data.token);
    localStorage.setItem('chocks_user', JSON.stringify(data.user));
    router.push('/');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('chocks_token');
    localStorage.removeItem('chocks_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
