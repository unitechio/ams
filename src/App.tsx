import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/guards/ProtectedRoute';
import { PERMISSIONS } from '@/auth/permissions';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminLayout } from '@/components/layout/AdminLayout';

// Pages (lazy loaded)
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import UsersPage from '@/pages/UsersPage';
import CreateUserPage from '@/pages/CreateUserPage';
import EditUserPage from '@/pages/EditUserPage';
import RolesPage from '@/pages/RolesPage';
import MenusPage from '@/pages/MenusPage';
import PermissionsPage from '@/pages/PermissionsPage';
import SettingsPage from '@/pages/SettingsPage';
import AssignRolePermissionsPage from '@/pages/AssignRolePermissionsPage';
import UserRolesPage from '@/pages/UserRolesPage';
import AuthHistoryPage from '@/pages/AuthHistoryPage';
import AuditLogPage from '@/pages/AuditLogPage';

/**
 * Common Layout for all authenticated pages
 * Prevents AdminLayout from re-mounting on route change
 */
function AuthenticatedLayout() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="auth-ui-theme">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated Routes with Persistent Layout */}
            <Route element={<AuthenticatedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Permission-gated routes */}
              <Route path="/users" element={
                <ProtectedRoute permissions={[PERMISSIONS.USER_READ]}><UsersPage /></ProtectedRoute>
              } />
              <Route path="/users/create" element={
                <ProtectedRoute permissions={[PERMISSIONS.USER_CREATE]}><CreateUserPage /></ProtectedRoute>
              } />
              <Route path="/users/:id/edit" element={
                <ProtectedRoute permissions={[PERMISSIONS.USER_UPDATE]}><EditUserPage /></ProtectedRoute>
              } />

              <Route path="/user-roles" element={
                <ProtectedRoute permissions={[PERMISSIONS.USER_UPDATE]}><UserRolesPage /></ProtectedRoute>
              } />

              <Route path="/roles" element={
                <ProtectedRoute permissions={[PERMISSIONS.ROLE_READ]}><RolesPage /></ProtectedRoute>
              } />
              <Route path="/roles/assign" element={
                <ProtectedRoute permissions={[PERMISSIONS.ROLE_UPDATE]}><AssignRolePermissionsPage /></ProtectedRoute>
              } />

              <Route path="/menus" element={
                <ProtectedRoute permissions={[PERMISSIONS.MENU_READ]}><MenusPage /></ProtectedRoute>
              } />
              <Route path="/permissions" element={
                <ProtectedRoute permissions={[PERMISSIONS.PERMISSION_READ]}><PermissionsPage /></ProtectedRoute>
              } />

              {/* Logs */}
              <Route path="/logs/auth" element={
                <ProtectedRoute permissions={[PERMISSIONS.AUTH_READ]}><AuthHistoryPage /></ProtectedRoute>
              } />
              <Route path="/logs/audit" element={
                <ProtectedRoute permissions={[PERMISSIONS.AUDIT_READ]}><AuditLogPage /></ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors closeButton expand />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
