/**
 * Menu Service — permission-based dynamic menu filtering
 */

import { getPermissionService } from '@/auth/permissionService';
import { type PermissionCode } from '@/auth/permissions';

export interface MenuNode {
  id: number;
  title: string;
  url: string;
  icon: string;
  sort_order: number;
  permission_code: string;
  parent_id: number | null;
  children?: MenuNode[];
}

export const STATIC_MENU: Omit<MenuNode, 'children'>[] = [
  { id: 1, title: 'Tổng quan', url: '/', icon: 'LayoutDashboard', sort_order: 9999, permission_code: '', parent_id: null },

  { id: 10, title: 'Hệ thống', url: '#', icon: 'Settings', sort_order: 1000, permission_code: '', parent_id: null },
  { id: 2, title: 'Người dùng', url: '/users', icon: 'Users', sort_order: 990, permission_code: 'user.read', parent_id: 10 },
  { id: 7, title: 'Cấp vai trò', url: '/user-roles', icon: 'UserPlus', sort_order: 980, permission_code: 'user.update', parent_id: 10 },
  { id: 3, title: 'Vai trò', url: '/roles', icon: 'Shield', sort_order: 970, permission_code: 'role.read', parent_id: 10 },
  { id: 8, title: 'Gán quyền Role', url: '/roles/assign', icon: 'ShieldCheck', sort_order: 960, permission_code: 'role.update', parent_id: 10 },

  { id: 20, title: 'Cấu hình', url: '#', icon: 'Wrench', sort_order: 800, permission_code: '', parent_id: null },
  { id: 4, title: 'Menu Sidebar', url: '/menus', icon: 'Menu', sort_order: 790, permission_code: 'menu.read', parent_id: 20 },
  { id: 5, title: 'Permission', url: '/permissions', icon: 'Key', sort_order: 780, permission_code: 'permission.read', parent_id: 20 },

  { id: 30, title: 'Nhật ký', url: '#', icon: 'FileText', sort_order: 500, permission_code: '', parent_id: null },
  { id: 31, title: 'Lịch sử Login', url: '/logs/auth', icon: 'History', sort_order: 490, permission_code: 'auth.read', parent_id: 30 },
  { id: 32, title: 'Audit Log', url: '/logs/audit', icon: 'Activity', sort_order: 480, permission_code: 'audit.read', parent_id: 30 },

  { id: 6, title: 'Cài đặt', url: '/settings', icon: 'Settings', sort_order: 100, permission_code: 'setting.read', parent_id: null },
];

function isVisible(item: Omit<MenuNode, 'children'>): boolean {
  if (!item.permission_code) return true;
  return getPermissionService().has(item.permission_code as PermissionCode);
}

export function buildPermissionMenu(flat: Omit<MenuNode, 'children'>[]): MenuNode[] {
  const visibleIds = new Set<number>();
  for (const item of flat) {
    if (isVisible(item)) visibleIds.add(item.id);
  }
  for (const item of flat) {
    if (visibleIds.has(item.id) && item.parent_id !== null) {
      let current = item;
      while (current.parent_id !== null) {
        visibleIds.add(current.parent_id);
        const parent = flat.find(m => m.id === current.parent_id);
        if (!parent) break;
        current = parent;
      }
    }
  }
  const byId = new Map<number, MenuNode>();
  for (const item of flat) {
    if (visibleIds.has(item.id)) {
      byId.set(item.id, { ...item, children: [] });
    }
  }
  const roots: MenuNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id === null) {
      roots.push(node);
    } else {
      const parent = byId.get(node.parent_id);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
      }
    }
  });
  const sortNodes = (nodes: MenuNode[]) => {
    nodes.sort((a, b) => b.sort_order - a.sort_order);
    nodes.forEach(n => n.children?.length && sortNodes(n.children));
  };
  sortNodes(roots);
  
  // Filter out top-level categories that have no visible children
  return roots.filter(root => {
    // If it's a real link, keep it
    if (root.url !== "#") return true;
    // If it's a category (#), only keep if it has children
    return root.children && root.children.length > 0;
  });
}


export function getVisibleNavItems(): Omit<MenuNode, 'children'>[] {
  // We want to return flat list but only those that are either roots or have no parents in STATIC_MENU
  // Actually, AdminLayout expects a flat list to render. If we use buildPermissionMenu, we get a tree.
  // Let's keep it simple for now and return all visible items.
  return STATIC_MENU.filter(isVisible).sort((a, b) => b.sort_order - a.sort_order);
}
