import React, { useState, useEffect } from 'react';
import { Shield, LogOut, ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { SidebarNavItem } from './SidebarNavItem';
import type { MenuNode } from '@/menu/menuService';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  navItems: MenuNode[];
  loadingNav: boolean;
}

export function AppSidebar({ collapsed, onToggle, navItems, loadingNav }: AppSidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Only ONE menu open at a time — when route changes auto-open parent
  const [openMenuId, setOpenMenuId] = useState<number | null>(() => {
    // Auto-open the parent whose child matches current path
    return null;
  });

  useEffect(() => {
    // When route changes, find which top-level parent is active and open it
    const findActiveParent = (items: MenuNode[]): number | null => {
      for (const item of items) {
        if (item.children?.length) {
          const childActive = item.children.some(c =>
            location.pathname === c.url ||
            (c.url && c.url !== '/' && location.pathname.startsWith(c.url + '/'))
          );
          if (childActive) return item.id;
        }
      }
      return null;
    };
    const activeParent = findActiveParent(navItems);
    if (activeParent !== null) setOpenMenuId(activeParent);
  }, [location.pathname, navItems]);

  const handleToggle = (id: number) => {
    setOpenMenuId(prev => (prev === id ? null : id));
  };

  // Build openMenus map: only the currently open menu is true
  const openMenus: Record<number, boolean> = openMenuId !== null ? { [openMenuId]: true } : {};

  const avatarLetter = user?.full_name?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shrink-0 h-screen z-40',
        'transition-[width] duration-300 ease-in-out will-change-[width]',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div data-tour="sidebar-brand" className={cn(
        'flex items-center h-[57px] shrink-0 border-b border-slate-100 dark:border-slate-800 px-3',
        collapsed ? 'justify-center' : 'gap-2.5'
      )}>
        <button
          onClick={() => navigate('/')}
          className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm hover:shadow-emerald-200 transition-shadow"
        >
          <Shield className="w-4 h-4 text-white" />
        </button>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none tracking-tight font-outfit">Auth Core</p>
            <p className="text-[10px] text-emerald-500 font-medium mt-0.5 tracking-wider">Control Panel</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav data-tour="sidebar-nav" className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-0.5">
        {loadingNav && !collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 shrink-0" />
            <span>Đang tải menu...</span>
          </div>
        )}
        {navItems.map(item => (
          <SidebarNavItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            level={0}
            openMenus={openMenus}
            onToggle={handleToggle}
          />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-2 h-px bg-slate-100 dark:bg-slate-800 shrink-0" />

      {/* Footer */}
      <div className="p-2 space-y-0.5 shrink-0">
        {/* User row */}
        <button
          onClick={() => navigate('/settings')}
          title={collapsed ? user?.full_name : undefined}
          className={cn(
            'w-full flex items-center rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left',
            collapsed ? 'justify-center' : 'gap-2.5'
          )}
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {avatarLetter}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-none">{user?.full_name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{user?.roles?.[0] ?? 'Admin'}</p>
            </div>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={cn(
            'w-full flex items-center rounded-lg px-2 py-2 text-[12px] text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 dark:hover:text-red-400 transition-colors',
            collapsed ? 'justify-center' : 'gap-2.5'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[72px] z-50 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm hover:bg-emerald-600 hover:border-emerald-600 dark:hover:bg-emerald-500 dark:hover:border-emerald-500 hover:text-white transition-colors"
        title={collapsed ? 'Mở rộng' : 'Thu gọn'}
      >
        <ChevronLeft className={cn('w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-300', collapsed && 'rotate-180')} />
      </button>
    </aside>
  );
}
