import { useNavigate } from 'react-router-dom';
import { Bell, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppBreadcrumb } from './AppBreadcrumb';

import { ThemeToggle } from '../ThemeToggle';

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100/80 dark:border-slate-800/80 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0">
      {/* Left: breadcrumb */}
      <div className="min-w-0">
        <AppBreadcrumb />
      </div>

      {/* Right: actions */}
      <div data-tour="header-actions" className="flex items-center gap-1 shrink-0 ml-4">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notification */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 group">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 group"
        >
          <Settings className="w-4.5 h-4.5 group-hover:rotate-45 transition-transform duration-300" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-100 dark:bg-slate-800 mx-1" />

        {/* User avatar */}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150 group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white text-[11px] font-black shadow-sm shadow-emerald-200/50">
            {user?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-[12px] font-semibold text-slate-900 dark:text-slate-200 leading-none font-outfit">
              {user?.full_name}
            </p>
            <p className="text-[10px] text-emerald-500 font-medium mt-0.5 uppercase tracking-wide">
              Admin
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}
