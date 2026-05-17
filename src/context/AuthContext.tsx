import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, setStepUpToken, onUnauthorized, type UserInfo, type LoginResponse } from '@/lib/api';
import { initPermissionService, clearPermissionService } from '@/auth/permissionService';

interface AuthContextValue {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  passwordChangeReason: 'one_time_password' | 'password_expired' | null;
  clearMustChangePassword: () => void;
  login: (username: string, password: string, options?: {
    client_id?: string;
    client_secret?: string;
    grant_type?: string;
    channel?: string;
    device_name?: string;
    device_fingerprint?: string;
    otp_code?: string;
    trust_device?: boolean;
  }) => Promise<LoginResponse>;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [passwordChangeReason, setPasswordChangeReason] = useState<'one_time_password' | 'password_expired' | null>(null);

  const logout = useCallback(() => {
    setToken(null);
    setStepUpToken(null);
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token');
    setUser(null);
    setMustChangePassword(false);
    setPasswordChangeReason(null);
    clearPermissionService();
    authApi.logout().catch(() => { });
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
        const expired = userData.password_expires_at ? new Date(userData.password_expires_at).getTime() <= Date.now() : false;
        const mustChange = Boolean(userData.one_time_password || expired);
        setMustChangePassword(mustChange);
        setPasswordChangeReason(userData.one_time_password ? 'one_time_password' : expired ? 'password_expired' : null);
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('access_token');
      })
      .finally(() => setIsLoading(false));
  }, [logout]);

  const login = useCallback(async (username: string, password: string, options?: {
    client_id?: string;
    client_secret?: string;
    grant_type?: string;
    channel?: string;
    device_name?: string;
    device_fingerprint?: string;
    otp_code?: string;
    trust_device?: boolean;
  }) => {
    const resp: LoginResponse = await authApi.login(username, password, options);
    setToken(resp.access_token);
    setStepUpToken(null);
    localStorage.setItem('access_token', resp.access_token);
    localStorage.setItem('refresh_token', resp.refresh_token);
    setUser(resp.user);
    initPermissionService(resp.user.permissions);
    const mustChange = Boolean(
      resp.must_change_password ||
      resp.password_expired ||
      resp.one_time_password ||
      resp.require_password_change,
    );
    setMustChangePassword(mustChange);
    setPasswordChangeReason(resp.password_change_reason ?? (resp.password_expired ? 'password_expired' : mustChange ? 'one_time_password' : null));
    return resp;
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
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        mustChangePassword,
        passwordChangeReason,
        clearMustChangePassword: () => {
          setMustChangePassword(false);
          setPasswordChangeReason(null);
        },
        login,
        logout,
        hasRole,
      }}
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
