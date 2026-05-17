import { lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import ProtectedRoute from "@/guards/ProtectedRoute";
import { PERMISSIONS } from "@/auth/permissions";
import { Loadable } from "@/components/Loadable";
import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";

// ─── Lazy Loaded Pages ───────────────────────────────────────────────────────
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const CreateUserPage = lazy(() => import("@/pages/CreateUserPage"));
const EditUserPage = lazy(() => import("@/pages/EditUserPage"));
const RolesPage = lazy(() => import("@/pages/RolesPage"));
const MenusPage = lazy(() => import("@/pages/MenusPage"));
const PermissionsPage = lazy(() => import("@/pages/PermissionsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AssignRolePermissionsPage = lazy(
  () => import("@/pages/AssignRolePermissionsPage"),
);
const UserRolesPage = lazy(() => import("@/pages/UserRolesPage"));
const AuthHistoryPage = lazy(() => import("@/pages/AuthHistoryPage"));
const AuditLogPage = lazy(() => import("@/pages/AuditLogPage"));
const DevicesPage = lazy(() => import("@/pages/DevicesPage"));
const AuthClientsPage = lazy(() => import("@/pages/AuthClientsPage"));
const ServiceAccountsPage = lazy(() => import("@/pages/ServiceAccountsPage"));
const SSOProvidersPage = lazy(() => import("@/pages/SSOProvidersPage"));
const LoginChannelsPage = lazy(() => import("@/pages/LoginChannelsPage"));
const SecurityPoliciesPage = lazy(() => import("@/pages/SecurityPoliciesPage"));
const OAuthCallbackPage = lazy(() => import("@/pages/OAuthCallbackPage"));
const SSOCallbackPage = lazy(() => import("@/pages/SSOCallbackPage"));

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: Loadable(LoginPage)({}),
  },
  {
    path: "/oauth/callback",
    element: Loadable(OAuthCallbackPage)({}),
  },
  {
    path: "/sso/callback/:provider",
    element: Loadable(SSOCallbackPage)({}),
  },
  {
    path: "/",
    element: <AuthenticatedLayout />,
    children: [
      {
        index: true,
        element: Loadable(DashboardPage)({}),
      },
      {
        path: "settings",
        element: Loadable(SettingsPage)({}),
      },
      // User Management
      {
        path: "users",
        children: [
          {
            index: true,
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.USER_READ]}>
                {Loadable(UsersPage)({})}
              </ProtectedRoute>
            ),
          },
          {
            path: "create",
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.USER_CREATE]}>
                {Loadable(CreateUserPage)({})}
              </ProtectedRoute>
            ),
          },
          {
            path: ":id/edit",
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.USER_UPDATE]}>
                {Loadable(EditUserPage)({})}
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: "user-roles",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.USER_UPDATE]}>
            {Loadable(UserRolesPage)({})}
          </ProtectedRoute>
        ),
      },
      // Role Management
      {
        path: "roles",
        children: [
          {
            index: true,
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.ROLE_READ]}>
                {Loadable(RolesPage)({})}
              </ProtectedRoute>
            ),
          },
          {
            path: "assign",
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.ROLE_UPDATE]}>
                {Loadable(AssignRolePermissionsPage)({})}
              </ProtectedRoute>
            ),
          },
        ],
      },
      // System Configuration
      {
        path: "menus",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.MENU_READ]}>
            {Loadable(MenusPage)({})}
          </ProtectedRoute>
        ),
      },
      {
        path: "permissions",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.PERMISSION_READ]}>
            {Loadable(PermissionsPage)({})}
          </ProtectedRoute>
        ),
      },
      // Logs & History
      {
        path: "logs",
        children: [
          {
            path: "auth",
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.AUTH_READ]}>
                {Loadable(AuthHistoryPage)({})}
              </ProtectedRoute>
            ),
          },
          {
            path: "audit",
            element: (
              <ProtectedRoute permissions={[PERMISSIONS.AUDIT_READ]}>
                {Loadable(AuditLogPage)({})}
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: "devices",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.DEVICE_READ]}>
            {Loadable(DevicesPage)({})}
          </ProtectedRoute>
        ),
      },
      {
        path: "auth-clients",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.CLIENT_READ]}>
            {Loadable(AuthClientsPage)({})}
          </ProtectedRoute>
        ),
      },
      {
        path: "sso-providers",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.CLIENT_READ]}>
            {Loadable(SSOProvidersPage)({})}
          </ProtectedRoute>
        ),
      },
      {
        path: "login-channels",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.CHANNEL_READ]}>
            {Loadable(LoginChannelsPage)({})}
          </ProtectedRoute>
        ),
      },
      {
        path: "security-policies",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.POLICY_READ]}>
            {Loadable(SecurityPoliciesPage)({})}
          </ProtectedRoute>
        ),
      },
      {
        path: "service-accounts",
        element: (
          <ProtectedRoute permissions={[PERMISSIONS.SERVICE_READ]}>
            {Loadable(ServiceAccountsPage)({})}
          </ProtectedRoute>
        ),
      },
    ],
  },
  // Fallback redirect
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
];
