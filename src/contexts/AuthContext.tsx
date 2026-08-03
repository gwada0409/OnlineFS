import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isEmployee: boolean;
  isApprover: boolean;
  isHR: boolean;
  isAdmin: boolean;
  isSystemAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('token');
  });

  const login = (newToken: string, newUser: User) => {
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const role = user?.role || '';
  const isAuthenticated = !!token && !!user;
  const isEmployee = role === 'Employee';
  const isApprover = ['Supervisor', 'DeptManager', 'HRManager', 'GeneralManager'].includes(role) || role === 'Admin' || role === 'SystemAdmin';
  const isHR = ['HRStaff', 'HRManager', 'Admin', 'SystemAdmin'].includes(role);
  const isAdmin = ['Admin', 'SystemAdmin'].includes(role);
  const isSystemAdmin = role === 'SystemAdmin';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isEmployee, isApprover, isHR, isAdmin, isSystemAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
