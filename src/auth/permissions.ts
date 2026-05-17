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

  // ── Device Management
  DEVICE_READ: 'device.read' as const,
  DEVICE_REVOKE: 'device.revoke' as const,

  CLIENT_READ: 'client.read' as const,
  CLIENT_CREATE: 'client.create' as const,
  CLIENT_UPDATE: 'client.update' as const,
  CLIENT_DELETE: 'client.delete' as const,

  SERVICE_READ: 'service.read' as const,
  SERVICE_CREATE: 'service.create' as const,
  SERVICE_UPDATE: 'service.update' as const,
  SERVICE_DELETE: 'service.delete' as const,

  CHANNEL_READ: 'channel.read' as const,
  CHANNEL_CREATE: 'channel.create' as const,
  CHANNEL_UPDATE: 'channel.update' as const,
  CHANNEL_DELETE: 'channel.delete' as const,

  POLICY_READ: 'policy.read' as const,
  POLICY_CREATE: 'policy.create' as const,
  POLICY_UPDATE: 'policy.update' as const,
  POLICY_DELETE: 'policy.delete' as const,

  OPTION_READ: 'option.read' as const,
  OPTION_CREATE: 'option.create' as const,
  OPTION_UPDATE: 'option.update' as const,
  OPTION_DELETE: 'option.delete' as const,

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
  {
    name: 'device', label: 'Thiết bị',
    permissions: [PERMISSIONS.DEVICE_READ, PERMISSIONS.DEVICE_REVOKE],
  },
  {
    name: 'client', label: 'OAuth Client',
    permissions: [PERMISSIONS.CLIENT_READ, PERMISSIONS.CLIENT_CREATE, PERMISSIONS.CLIENT_UPDATE, PERMISSIONS.CLIENT_DELETE],
  },
  {
    name: 'service', label: 'Service Account',
    permissions: [PERMISSIONS.SERVICE_READ, PERMISSIONS.SERVICE_CREATE, PERMISSIONS.SERVICE_UPDATE, PERMISSIONS.SERVICE_DELETE],
  },
  {
    name: 'channel', label: 'Login Channel',
    permissions: [PERMISSIONS.CHANNEL_READ, PERMISSIONS.CHANNEL_CREATE, PERMISSIONS.CHANNEL_UPDATE, PERMISSIONS.CHANNEL_DELETE],
  },
  {
    name: 'policy', label: 'Security Policy',
    permissions: [PERMISSIONS.POLICY_READ, PERMISSIONS.POLICY_CREATE, PERMISSIONS.POLICY_UPDATE, PERMISSIONS.POLICY_DELETE],
  },
  {
    name: 'option', label: 'Reference Option',
    permissions: [PERMISSIONS.OPTION_READ, PERMISSIONS.OPTION_CREATE, PERMISSIONS.OPTION_UPDATE, PERMISSIONS.OPTION_DELETE],
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
  'device.read':        'Xem thiết bị đăng nhập',
  'device.revoke':      'Thu hồi thiết bị đăng nhập',
  'client.read':        'Xem auth clients',
  'client.create':      'Tạo auth client',
  'client.update':      'Sửa auth client',
  'client.delete':      'Xóa auth client',
  'service.read':       'Xem service account',
  'service.create':     'Tạo service account',
  'service.update':     'Sửa service account',
  'service.delete':     'Xóa service account',
  'channel.read':       'Xem login channel',
  'channel.create':     'Tạo login channel',
  'channel.update':     'Sửa login channel',
  'channel.delete':     'Xóa login channel',
  'policy.read':        'Xem security policy',
  'policy.create':      'Tạo security policy',
  'policy.update':      'Sửa security policy',
  'policy.delete':      'Xóa security policy',
  'option.read':        'Xem reference option',
  'option.create':      'Tạo reference option',
  'option.update':      'Sửa reference option',
  'option.delete':      'Xóa reference option',
  '*':                  'Toàn quyền (Super Admin)',
};
