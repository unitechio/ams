import React from 'react';
import { usePermission } from '@/auth/usePermission';
import { type PermissionCode, type ScopeCode } from '@/auth/permissions';

// ─── Guard Props ─────────────────────────────────────────────────────────────
interface GuardProps {
  /** Single permission required */
  permission?: PermissionCode;
  /** Any of these permissions (OR logic) */
  anyOf?: PermissionCode[];
  /** All of these permissions (AND logic) */
  allOf?: PermissionCode[];
  /** Minimum data scope required */
  scope?: ScopeCode;
  /** What to render when access is denied (default: null) */
  fallback?: React.ReactNode;
  /** The content to protect */
  children: React.ReactNode;
}

/**
 * Guard — declarative permission-based UI guard component
 *
 * Renders children only if the user has the required permission(s).
 * Falls back to `fallback` (or null) when access is denied.
 *
 * IMPORTANT: This is a UX guard only. Backend enforces security.
 *
 * @example
 * // Single permission
 * <Guard permission={PERMISSIONS.USER_CREATE}>
 *   <Button>Add User</Button>
 * </Guard>
 *
 * // Any of permissions
 * <Guard anyOf={[PERMISSIONS.USER_READ, PERMISSIONS.USER_EXPORT]}>
 *   <ExportButton />
 * </Guard>
 *
 * // With scope
 * <Guard permission={PERMISSIONS.REPORT_EXPORT} scope={SCOPES.DEPARTMENT}>
 *   <ExportButton />
 * </Guard>
 *
 * // With fallback
 * <Guard permission={PERMISSIONS.USER_DELETE} fallback={<span>Read-only</span>}>
 *   <DeleteButton />
 * </Guard>
 */
export function Guard({ permission, anyOf, allOf, scope, fallback = null, children }: GuardProps) {
  const { can, canAny, canAll, canWithScope } = usePermission();

  let allowed = false;

  if (scope && permission) {
    allowed = canWithScope(permission, scope);
  } else if (permission) {
    allowed = can(permission);
  } else if (anyOf && anyOf.length > 0) {
    allowed = canAny(...anyOf);
  } else if (allOf && allOf.length > 0) {
    allowed = canAll(...allOf);
  } else {
    // No restriction specified → show to all authenticated users
    allowed = true;
  }

  return <>{allowed ? children : fallback}</>;
}

// ─── Convenience Variants ─────────────────────────────────────────────────────

/** Hides children when user has the permission (inverse guard - for "locked" states) */
export function GuardNot({ permission, children }: { permission: PermissionCode; children: React.ReactNode }) {
  const { can } = usePermission();
  return <>{can(permission) ? null : children}</>;
}

/** Renders an icon/badge/overlay when user lacks a permission */
export function GuardOrDisabled({
  permission,
  children,
  disabledClass = 'opacity-40 pointer-events-none cursor-not-allowed',
}: {
  permission: PermissionCode;
  children: React.ReactNode;
  disabledClass?: string;
}) {
  const { can } = usePermission();
  if (can(permission)) return <>{children}</>;
  return <span className={disabledClass} title="Không có quyền truy cập">{children}</span>;
}
