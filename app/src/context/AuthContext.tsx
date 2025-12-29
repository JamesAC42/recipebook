'use client';

import React, { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('recipe_auth_token');
  });
  const [username, setUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('recipe_username');
  });
  const router = useRouter();

  const login = (token: string, username: string) => {
    localStorage.setItem('recipe_auth_token', token);
    localStorage.setItem('recipe_username', username);
    setToken(token);
    setUsername(username);
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('recipe_auth_token');
    localStorage.removeItem('recipe_username');
    setToken(null);
    setUsername(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ token, username, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

