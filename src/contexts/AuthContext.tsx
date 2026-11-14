import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../lib/api';

export interface User {
  id: number;
  username: string;
  role: string;
  orgRole?: string;
  isApprover?: boolean;
  capabilities?: string[];
}

export const legacyCapabilities = (user: User | null): string[] => {
  if (!user) return [];
  const role = (user.orgRole || user.role || '').trim();
  if (role === 'SystemAdmin') return ['HROperations', 'HRManagement', 'SystemOperations', 'SystemAlertManagement', 'UserRoleManagement'];
  if (role === 'Admin') return ['HROperations', 'HRManagement', 'SystemOperations', 'SystemAlertManagement'];
  if (role === 'Editor') return [];
  return [
    'PersonalLeave',
    ...(user.isApprover ? ['Approvals'] : []),
    ...(['HRStaff', 'HRManager'].includes(role) ? ['HROperations'] : []),
    ...(role === 'HRManager' ? ['HRManagement'] : [])
  ];
};

export const canViewPendingApprovals = (user: User | null): boolean => {
  if (!user) return false;
  if (user.capabilities) return user.capabilities.includes('Approvals');
  if (user.isApprover && !['Admin', 'SystemAdmin', 'Editor'].includes(user.role)) return true;
  

  return false;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isEmployee: boolean;
  isApprover: boolean;
  canViewPendingApprovals: boolean;
  isHR: boolean;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  capabilities: string[];
  accessLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    if (!stored) return null;
    try { return JSON.parse(stored) as User; }
    catch { sessionStorage.removeItem('user'); sessionStorage.removeItem('token'); return null; }
  });

  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('token');
  });
  const [capabilities, setCapabilities] = useState<string[]>(() => user?.capabilities || legacyCapabilities(user));
  const [accessLoading, setAccessLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setCapabilities(user?.capabilities || legacyCapabilities(user));
    if (!token) { setAccessLoading(false); return; }
    setAccessLoading(true);
    const refreshAccess = () => api.get<{ capabilities: string[] }>('/auth/access').then(response => {
      if (active) {
        setCapabilities(response.data.capabilities);
        setUser(previous => previous ? { ...previous, capabilities: response.data.capabilities } : null);
      }
    }).catch(() => {
      if (active) {
        setCapabilities([]);
      }
    }).finally(() => { if (active) setAccessLoading(false); });
    void refreshAccess();
    window.addEventListener('onlinefs:organization-changed', refreshAccess);
    return () => { active = false; window.removeEventListener('onlinefs:organization-changed', refreshAccess); };
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    const loginCapabilities = newUser.capabilities || legacyCapabilities(newUser);
    newUser = { ...newUser, capabilities: loginCapabilities };
    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setCapabilities(loginCapabilities);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); }
    catch { /* Local sign-out must still succeed if the session is already expired or offline. */ }
    finally {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setCapabilities([]);
    }
  };

  const isAuthenticated = !!token && !!user;
  const isEmployee = capabilities.includes('PersonalLeave');
  const isApprover = capabilities.includes('Approvals');
  // HR operators and privileged administrators can access HR administration.
  const isHR = capabilities.includes('HROperations');
  const isAdmin = capabilities.includes('SystemOperations');
  const isSystemAdmin = capabilities.includes('UserRoleManagement');

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, isEmployee, isApprover, canViewPendingApprovals: isApprover, isHR, isAdmin, isSystemAdmin, capabilities, accessLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
