import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Map path segments → readable labels
const LABEL_MAP: Record<string, string> = {
  users: 'Người dùng',
  roles: 'Vai trò',
  menus: 'Menu',
  permissions: 'Permission',
  settings: 'Cài đặt',
  logs: 'Nhật ký',
  auth: 'Lịch sử Login',
  audit: 'Audit Log',
  create: 'Tạo mới',
  edit: 'Chỉnh sửa',
  assign: 'Phân quyền',
  'user-roles': 'Cấp vai trò',
};

function getLabel(segment: string): string {
  return LABEL_MAP[segment] ?? segment.replace(/-/g, ' ');
}

export function AppBreadcrumb() {
  const location = useLocation();
  const paths = location.pathname.split('/').filter(Boolean);

  if (paths.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 mb-1" aria-label="breadcrumb">
      <NavLink
        to="/"
        className="text-[11px] font-medium text-slate-400 hover:text-emerald-600 transition-colors"
      >
        Dashboard
      </NavLink>
      {paths.map((seg, i) => {
        const isLast = i === paths.length - 1;
        // Build the URL up to this segment
        const url = `/${paths.slice(0, i + 1).join('/')}`;

        // Handle cases where the segment is an ID or a sub-action (create, edit)
        // If it's the last segment, it's just text. 
        // If it's a middle segment, it should usually point to the list page.
        // For example: /users/123/edit -> breadcrumbs: Dashboard > Users > 123 > Edit
        // Users should link to /users. 123 might link to /users (since we don't have a view page for 1 user usually).

        const label = getLabel(seg);
        const isNumeric = !isNaN(Number(seg));

        return (
          <React.Fragment key={`${seg}-${i}`}>
            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="text-[11px] font-semibold text-emerald-600 capitalize">
                {isNumeric ? `#${seg}` : label}
              </span>
            ) : (
              <NavLink
                to={url}
                className="text-[11px] font-medium text-slate-400 hover:text-emerald-600 transition-colors capitalize"
              >
                {label}
              </NavLink>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
