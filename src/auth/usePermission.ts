import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getPermissionService } from './permissionService';
import { type PermissionCode, type ScopeCode } from './permissions';

/**
 * usePermission — primary hook for permission-based UI control
 *
 * Returns helper functions to check permissions from the current session.
 * ONLY use this for UX (hiding/showing elements).
 * Backend re-validates all actions server-side.
 *
 * @example
 * const { can, canAny, isSuperAdmin } = usePermission();
 *
 * if (can(PERMISSIONS.USER_CREATE)) { ... }
 * <Guard permission={PERMISSIONS.USER_DELETE}><button>Delete</button></Guard>
 */
export function usePermission() {
  const { isAuthenticated } = useAuth();

  const can = useCallback(
    (permission: PermissionCode): boolean => {
      if (!isAuthenticated) return false;
      return getPermissionService().has(permission);
    },
    [isAuthenticated]
  );

  const canWithScope = useCallback(
    (permission: PermissionCode, minScope: ScopeCode): boolean => {
      if (!isAuthenticated) return false;
      return getPermissionService().hasWithScope(permission, minScope);
    },
    [isAuthenticated]
  );

  const canAny = useCallback(
    (...permissions: PermissionCode[]): boolean => {
      if (!isAuthenticated) return false;
      return getPermissionService().hasAny(...permissions);
    },
    [isAuthenticated]
  );

  const canAll = useCallback(
    (...permissions: PermissionCode[]): boolean => {
      if (!isAuthenticated) return false;
      return getPermissionService().hasAll(...permissions);
    },
    [isAuthenticated]
  );

  const getScope = useCallback(
    (permission: PermissionCode): ScopeCode | undefined => {
      if (!isAuthenticated) return undefined;
      return getPermissionService().getScope(permission);
    },
    [isAuthenticated]
  );

  const isSuperAdmin = useCallback((): boolean => {
    if (!isAuthenticated) return false;
    return getPermissionService().isSuperAdmin();
  }, [isAuthenticated]);

  return { can, canWithScope, canAny, canAll, getScope, isSuperAdmin };
}

/**
 * useHasPermission — simplified single-permission check hook
 *
 * @example
 * const canExport = useHasPermission(PERMISSIONS.REPORT_EXPORT);
 */
export function useHasPermission(permission: PermissionCode): boolean {
  const { can } = usePermission();
  return can(permission);
}
