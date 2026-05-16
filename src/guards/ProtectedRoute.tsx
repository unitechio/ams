import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/auth/usePermission';
import { type PermissionCode } from '@/auth/permissions';
import { Loader2, ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require ALL of these permissions */
  permissions?: PermissionCode[];
  /** Require ANY of these permissions */
  anyPermission?: PermissionCode[];
  /** Redirect to when unauthorized (default: /login) */
  redirectTo?: string;
}

/**
 * ProtectedRoute — permission-based route guard
 *
 * - Redirects to /login if not authenticated
 * - Shows 403 page if authenticated but lacking permissions
 * - Supports both "all" and "any" permission requirements
 *
 * IMPORTANT: Backend validates every API call. This is UX only.
 *
 * @example
 * <Route path="/users" element={
 *   <ProtectedRoute permissions={[PERMISSIONS.USER_READ]}>
 *     <UsersPage />
 *   </ProtectedRoute>
 * } />
 */
export default function ProtectedRoute({
  children,
  permissions,
  anyPermission,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { canAll, canAny, isSuperAdmin } = usePermission();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Super admin bypasses all permission checks
  if (isSuperAdmin()) return <>{children}</>;

  // Check permission requirements
  const hasAccess = (() => {
    if (!permissions?.length && !anyPermission?.length) return true;
    if (permissions?.length && !canAll(...permissions)) return false;
    if (anyPermission?.length && !canAny(...anyPermission)) return false;
    return true;
  })();

  if (!hasAccess) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

// ─── 403 Page ─────────────────────────────────────────────────────────────────
function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-gray-200 mb-1">403</h1>
        <p className="font-semibold text-gray-800 mb-1">Không có quyền truy cập</p>
        <p className="text-sm text-gray-500">
          Bạn không được phép truy cập trang này. Vui lòng liên hệ quản trị viên để được cấp quyền.
        </p>
      </div>
    </div>
  );
}
