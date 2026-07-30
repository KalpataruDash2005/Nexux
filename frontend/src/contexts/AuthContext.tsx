import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthResponseDto } from '../types/auth';

interface AuthContextType {
  token: string | null;
  user: { email: string; role: string } | null;
  login: (data: AuthResponseDto) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    if (token) {
      // Decode JWT or fetch user details here if needed.
      // For now, we will store user info in localStorage as well for simplicity.
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
  }, [token]);

  const login = (data: AuthResponseDto) => {
    localStorage.setItem('token', data.token);
    const userInfo = { email: data.email, role: data.role };
    localStorage.setItem('user', JSON.stringify(userInfo));
    setToken(data.token);
    setUser(userInfo);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
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
