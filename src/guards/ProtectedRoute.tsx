import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/auth/usePermission';
import { type PermissionCode, PERMISSION_LABELS } from '@/auth/permissions';
import { Loader2, ShieldOff, Home, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();
  const { canAll, canAny, isSuperAdmin } = usePermission();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (mustChangePassword && location.pathname !== '/login') {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
    return <ForbiddenPage requiredPermissions={permissions ?? anyPermission ?? []} />;
  }

  return <>{children}</>;
}

// ─── 403 Forbidden Page ──────────────────────────────────────────────────
function ForbiddenPage({ requiredPermissions }: { requiredPermissions: PermissionCode[] }) {
  const navigate = useNavigate();

  // Translate required permissions to human-readable labels, show category only
  const requiredLabels = requiredPermissions
    .map(p => PERMISSION_LABELS[p] ?? p)
    // Deduplicate by permission group name (e.g. 'role.read' -> 'Quản lý vai trò')
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 3); // cap at 3 to avoid info overload

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          {/* Top accent stripe */}
          <div className="h-1.5 bg-gradient-to-r from-red-400 via-orange-400 to-red-500" />

          <div className="p-8 text-center">
            {/* Icon */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-2xl bg-red-50 dark:bg-red-950/50 rotate-6" />
              <div className="relative w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 flex items-center justify-center shadow-md">
                <ShieldOff className="w-9 h-9 text-red-400" />
              </div>
            </div>

            {/* Code */}
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400 dark:text-red-500 mb-2">
              Truy cập bị từ chối
            </p>

            {/* Title */}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Không đủ quyền
            </h1>

            {/* Description */}
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Trang này yêu cầu quyền truy cập mà tài khoản của bạn hiện không có.
              Vui lòng liên hệ quản trị viên để được cấp quyền.
            </p>

            {/* Required permission hint (generic, not technical) */}
            {requiredLabels.length > 0 && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-2">
                  Yêu cầu quyền
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {requiredLabels.map(label => (
                    <span key={label}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 rounded-xl border-slate-200 dark:border-slate-700"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="w-4 h-4" /> Quay lại
              </Button>
              <Button
                className="flex-1 gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900"
                onClick={() => navigate('/', { replace: true })}
              >
                <Home className="w-4 h-4" /> Trang chủ
              </Button>
            </div>
          </div>
        </div>

        {/* Footer note - generic, no technical details */}
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-4">
          Nếu bạn cho rằng đây là lỗi, vui lòng liên hệ bộ phận hỗ trợ.
        </p>
      </div>
    </div>
  );
}
