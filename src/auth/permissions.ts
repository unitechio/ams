/**
 * Centralized Permission Constants
 *
 * IMPORTANT:
 * - These match the backend Go constants EXACTLY.
 * - Use these constants throughout the codebase; never write raw strings.
 * - Frontend authorization is for UX ONLY (hide/show buttons, menus).
 * - Backend is the source of truth - always re-validate server-side.
 */

export const PERMISSIONS = {
  // ── User Management
  USER_READ:   'user.read'   as const,
  USER_CREATE: 'user.create' as const,
  USER_UPDATE: 'user.update' as const,
  USER_DELETE: 'user.delete' as const,
  USER_EXPORT: 'user.export' as const,

  // ── Role Management
  ROLE_READ:   'role.read'   as const,
  ROLE_CREATE: 'role.create' as const,
  ROLE_UPDATE: 'role.update' as const,
  ROLE_DELETE: 'role.delete' as const,
  ROLE_ASSIGN: 'role.assign' as const,

  // ── Permission Management
  PERMISSION_READ:   'permission.read'   as const,
  PERMISSION_CREATE: 'permission.create' as const,
  PERMISSION_UPDATE: 'permission.update' as const,
  PERMISSION_DELETE: 'permission.delete' as const,
  PERMISSION_ASSIGN: 'permission.assign' as const,

  // ── Menu Management
  MENU_READ:   'menu.read'   as const,
  MENU_CREATE: 'menu.create' as const,
  MENU_UPDATE: 'menu.update' as const,
  MENU_DELETE: 'menu.delete' as const,

  // ── Reports
  REPORT_VIEW:   'report.view'   as const,
  REPORT_EXPORT: 'report.export' as const,

  // ── Settings
  SETTING_READ:   'setting.read'   as const,
  SETTING_UPDATE: 'setting.update' as const,

  // ── Audit
  AUDIT_READ: 'audit.read' as const,
  AUTH_READ:  'auth.read'  as const,

  // ── Wildcard (Super Admin bypass)
  WILDCARD: '*' as const,
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Scope Constants ─────────────────────────────────────────────────────────
export const SCOPES = {
  SELF:         'self',
  DEPARTMENT:   'department',
  ORGANIZATION: 'organization',
  GLOBAL:       'global',
} as const;

export type ScopeCode = (typeof SCOPES)[keyof typeof SCOPES];

// ─── Effective Permission (permission + scope pair from JWT/API) ──────────────
export interface EffectivePermission {
  permission: PermissionCode;
  scope: ScopeCode;
}

// ─── Permission Group for display ────────────────────────────────────────────
export const PERMISSION_GROUPS: { name: string; label: string; permissions: PermissionCode[] }[] = [
  {
    name: 'user', label: 'Quản lý người dùng',
    permissions: [PERMISSIONS.USER_READ, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE, PERMISSIONS.USER_EXPORT],
  },
  {
    name: 'role', label: 'Quản lý vai trò',
    permissions: [PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_UPDATE, PERMISSIONS.ROLE_DELETE, PERMISSIONS.ROLE_ASSIGN],
  },
  {
    name: 'permission', label: 'Quản lý quyền hạn',
    permissions: [PERMISSIONS.PERMISSION_READ, PERMISSIONS.PERMISSION_CREATE, PERMISSIONS.PERMISSION_UPDATE, PERMISSIONS.PERMISSION_DELETE, PERMISSIONS.PERMISSION_ASSIGN],
  },
  {
    name: 'menu', label: 'Cấu hình Menu',
    permissions: [PERMISSIONS.MENU_READ, PERMISSIONS.MENU_CREATE, PERMISSIONS.MENU_UPDATE, PERMISSIONS.MENU_DELETE],
  },
  {
    name: 'report', label: 'Báo cáo',
    permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT],
  },
  {
    name: 'setting', label: 'Cài đặt',
    permissions: [PERMISSIONS.SETTING_READ, PERMISSIONS.SETTING_UPDATE],
  },
  {
    name: 'audit', label: 'Nhật ký',
    permissions: [PERMISSIONS.AUDIT_READ, PERMISSIONS.AUTH_READ],
  },
];

// Permission display names
export const PERMISSION_LABELS: Record<string, string> = {
  'user.read':          'Xem người dùng',
  'user.create':        'Tạo người dùng',
  'user.update':        'Sửa người dùng',
  'user.delete':        'Xóa người dùng',
  'user.export':        'Xuất dữ liệu người dùng',
  'role.read':          'Xem vai trò',
  'role.create':        'Tạo vai trò',
  'role.update':        'Sửa vai trò',
  'role.delete':        'Xóa vai trò',
  'role.assign':        'Gán vai trò',
  'permission.read':    'Xem quyền hạn',
  'permission.create':  'Tạo quyền hạn',
  'permission.update':  'Sửa quyền hạn',
  'permission.delete':  'Xóa quyền hạn',
  'permission.assign':  'Phân quyền',
  'menu.read':          'Xem menu',
  'menu.create':        'Tạo menu',
  'menu.update':        'Sửa menu',
  'menu.delete':        'Xóa menu',
  'report.view':        'Xem báo cáo',
  'report.export':      'Xuất báo cáo',
  'setting.read':       'Xem cài đặt',
  'setting.update':     'Cập nhật cài đặt',
  'audit.read':         'Xem nhật ký audit',
  'auth.read':          'Xem lịch sử login',
  '*':                  'Toàn quyền (Super Admin)',
};
