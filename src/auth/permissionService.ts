/**
 * PermissionService
 *
 * Encapsulates all permission checking logic on the frontend.
 *
 * IMPORTANT RULES:
 * - This service is for UX purposes ONLY (hide/show UI elements).
 * - NEVER rely on this for security decisions.
 * - Backend re-validates EVERY request.
 * - Permissions come from the authenticated session (API response).
 * - Never read permissions from localStorage directly for security checks.
 */

import { PERMISSIONS, SCOPES, type PermissionCode, type ScopeCode } from './permissions';

// ─── Permission Entry ────────────────────────────────────────────────────────
// Format from API: "user.read:self" or "*" (wildcard)
type RawPermission = string;

// ─── Permission Service ──────────────────────────────────────────────────────

export class PermissionService {
  private permMap: Map<PermissionCode, ScopeCode>;
  private isWildcard: boolean;

  constructor(rawPermissions: RawPermission[]) {
    this.permMap = new Map();
    this.isWildcard = false;

    for (const raw of rawPermissions) {
      if (raw === PERMISSIONS.WILDCARD || raw === '*') {
        this.isWildcard = true;
        break;
      }
      const [perm, scope] = raw.split(':') as [PermissionCode, ScopeCode];
      const existingScope = this.permMap.get(perm);
      // Keep broadest scope if same permission appears multiple times
      if (!existingScope || scopeLevel(scope) > scopeLevel(existingScope)) {
        this.permMap.set(perm, scope ?? SCOPES.SELF);
      }
    }
  }

  /** Check if user has a specific permission (scope-independent) */
  has(permission: PermissionCode): boolean {
    if (this.isWildcard) return true;
    return this.permMap.has(permission);
  }

  /** Check if user has permission with at least the given scope */
  hasWithScope(permission: PermissionCode, minScope: ScopeCode): boolean {
    if (this.isWildcard) return true;
    const scope = this.permMap.get(permission);
    if (!scope) return false;
    return scopeLevel(scope) >= scopeLevel(minScope);
  }

  /** Check if user has ANY of the given permissions */
  hasAny(...permissions: PermissionCode[]): boolean {
    if (this.isWildcard) return true;
    return permissions.some((p) => this.permMap.has(p));
  }

  /** Check if user has ALL of the given permissions */
  hasAll(...permissions: PermissionCode[]): boolean {
    if (this.isWildcard) return true;
    return permissions.every((p) => this.permMap.has(p));
  }

  /** Get the effective scope for a permission */
  getScope(permission: PermissionCode): ScopeCode | undefined {
    if (this.isWildcard) return SCOPES.GLOBAL;
    return this.permMap.get(permission);
  }

  /** Returns true for super admin (wildcard) */
  isSuperAdmin(): boolean {
    return this.isWildcard;
  }

  /** List all effective permissions as "perm:scope" strings */
  list(): string[] {
    if (this.isWildcard) return ['*'];
    const result: string[] = [];
    this.permMap.forEach((scope, perm) => result.push(`${perm}:${scope}`));
    return result;
  }
}

// ─── Scope Level (higher = broader access) ───────────────────────────────────
function scopeLevel(scope: ScopeCode): number {
  switch (scope) {
    case SCOPES.SELF:         return 1;
    case SCOPES.DEPARTMENT:   return 2;
    case SCOPES.ORGANIZATION: return 3;
    case SCOPES.GLOBAL:       return 4;
    default:                  return 0;
  }
}

// ─── Singleton (recreated when user logs in/out) ──────────────────────────────
let _service: PermissionService | null = null;

export function initPermissionService(rawPermissions: RawPermission[]): PermissionService {
  _service = new PermissionService(rawPermissions);
  return _service;
}

export function getPermissionService(): PermissionService {
  if (!_service) {
    // Return empty service (deny all) if not initialized
    return new PermissionService([]);
  }
  return _service;
}

export function clearPermissionService(): void {
  _service = null;
}
