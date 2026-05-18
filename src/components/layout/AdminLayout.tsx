import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { authApi, type ApiMenu } from '@/lib/api';
import { getVisibleNavItems, buildPermissionMenu, type MenuNode } from '@/menu/menuService';
import { resumeWorkflowTour, subscribeWorkflowTours } from '@/lib/workflowTours';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [navItems, setNavItems] = useState<MenuNode[]>([]);
  const [loadingNav, setLoadingNav] = useState(true);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    authApi.myMenus()
      .then((menus: ApiMenu[]) => {
        if (menus.length > 0) {
          const flat = menus.map(m => ({
            id: m.id,
            title: m.title,
            url: m.url || '#',
            icon: m.icon || 'LayoutDashboard',
            sort_order: m.sort_order,
            permission_code: m.permission_code,
            parent_id: m.parent_id,
          }));
          setNavItems(buildPermissionMenu(flat));
        } else {
          setNavItems(buildPermissionMenu(getVisibleNavItems() as any));
        }
      })
      .catch(() => {
        setNavItems(getVisibleNavItems() as any);
      })
      .finally(() => setLoadingNav(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = subscribeWorkflowTours(() => {
      resumeWorkflowTour(window.location.pathname, navigate);
    });
    return unsubscribe;
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    resumeWorkflowTour(location.pathname, navigate);
  }, [isAuthenticated, location.pathname, navigate]);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      <AppSidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        navItems={navItems}
        loadingNav={loadingNav}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AppHeader />

        {/* Page content - key forces remount only on actual route changes, not layout re-renders */}
        <main
          key={location.pathname}
          className={cn(
            'flex-1 overflow-y-auto custom-scrollbar',
            'animate-in fade-in duration-200',
            'p-6 pt-4'
          )}
        >
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
