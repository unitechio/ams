// ─── Types ───────────────────────────────────────────────────────────────────

export interface Role {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  status: "active" | "inactive";
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  roleId: number;
  roleName: string;
  status: "active" | "inactive" | "locked";
  createdAt: string;
  lastLogin?: string;
}

export interface MenuItem {
  id: number;
  title: string;
  url: string;
  parentId?: number;
  parentTitle?: string;
  order: number;
  icon?: string;
  level: number;
}

export interface Permission {
  id: number;
  name: string;
  description: string;
  menuId: number;
  menuTitle: string;
  roleId?: number;
  roleName?: string;
  status: "active" | "inactive";
}

export interface PermissionDetail {
  id: number;
  controller: string;
  action: string;
  description: string;
  permissionId: number;
}
