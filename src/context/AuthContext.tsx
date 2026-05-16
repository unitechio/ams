import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, onUnauthorized, type UserInfo, type LoginResponse } from '@/lib/api';
import { initPermissionService, clearPermissionService } from '@/auth/permissionService';

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    authApi.logout().catch(() => { });
    setToken(null);
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token');
    setUser(null);
    clearPermissionService();
    window.location.href = '/login';
  }, []);

  // On mount: restore session
  useEffect(() => {
    onUnauthorized(logout);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    setToken(token);
    authApi.me()
      .then(userData => {
        setUser(userData);
        initPermissionService(userData.permissions);
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('access_token');
      })
      .finally(() => setIsLoading(false));
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const resp: LoginResponse = await authApi.login(username, password);
    setToken(resp.access_token);
    localStorage.setItem('access_token', resp.access_token);
    localStorage.setItem('refresh_token', resp.refresh_token);
    setUser(resp.user);
    initPermissionService(resp.user.permissions);
  }, []);

  const hasRole = useCallback(
    (role: string) => user?.roles.some((r) => r.toLowerCase() === role.toLowerCase()) ?? false,
    [user]
  );

  const hasPermission = useCallback(
    (controller: string, action: string) =>
      user?.permissions.includes(`${controller}:${action}`) ?? false,
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
