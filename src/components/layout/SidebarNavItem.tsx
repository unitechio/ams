import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuNode } from "@/menu/menuService";

function resolveIcon(
  name: string,
): React.ComponentType<{ className?: string }> {
  if (!name) return LayoutDashboard;
  const icon = (LucideIcons as any)[name];
  return icon || LayoutDashboard;
}

interface NavItemProps {
  item: MenuNode;
  collapsed: boolean;
  level?: number;
  openMenus: Record<number, boolean>;
  onToggle: (id: number) => void;
}

export function SidebarNavItem({
  item,
  collapsed,
  level = 0,
  openMenus,
  onToggle,
}: NavItemProps) {
  const location = useLocation();
  const hasChildren = !!item.children?.length;
  const isOpen = openMenus[item.id] ?? false;

  const isLinkActive =
    item.url !== "#" &&
    (location.pathname === item.url ||
      (item.url !== "/" && location.pathname.startsWith(item.url + "/")));

  const isChildActive =
    hasChildren &&
    item.children!.some(
      (c) =>
        location.pathname === c.url ||
        (c.url !== "/" && location.pathname.startsWith(c.url + "/")),
    );

  const Icon = resolveIcon(item.icon);

  const contentRef = useRef<HTMLDivElement>(null);

  if (item.url === "#" && level === 0 && !hasChildren) {
    return (
      <div
        className={cn(
          "mt-6 mb-1.5 overflow-hidden transition-all duration-300",
          collapsed ? "px-0 opacity-0 max-h-0" : "px-3 opacity-100 max-h-10",
        )}
      >
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] pl-3">
          {item.title}
        </span>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      onToggle(item.id);
    }
  };

  const itemClasses = cn(
    "flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer select-none relative group",
    level > 0 ? "py-2 px-3 ml-3 text-[13px]" : "py-2.5 px-3 text-[13px]",
    collapsed && level === 0 ? "justify-center" : "",
    isLinkActive
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200/60 dark:shadow-emerald-950/40"
      : isChildActive && !isLinkActive
        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50",
  );

  return (
    <div className="flex flex-col">
      <NavLink
        to={hasChildren ? "#" : item.url}
        onClick={handleClick}
        className={itemClasses}
        end={item.url === "/"}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex items-center justify-center shrink-0 transition-transform duration-200",
            collapsed && level === 0 ? "w-6 h-6" : "w-5 h-5",
            isLinkActive
              ? "text-white"
              : isChildActive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300",
          )}
        >
          <Icon
            className={cn(
              collapsed && level === 0 ? "`w-4.5 `h-4.5" : "w-[16px] h-[16px]",
            )}
          />
        </div>

        {/* Label */}
        {!collapsed && (
          <>
            <span
              className={cn(
                "flex-1 truncate font-medium leading-none",
                isLinkActive ? "font-semibold text-white" : "",
              )}
            >
              {item.title}
            </span>
            {hasChildren && (
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 shrink-0 transition-transform duration-300 opacity-50",
                  isOpen ? "rotate-180 opacity-100" : "",
                  isLinkActive ? "text-white" : "",
                )}
              />
            )}
          </>
        )}

        {/* Collapsed tooltip */}
        {collapsed && level === 0 && (
          <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 shadow-xl pointer-events-none">
            {item.title}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
          </div>
        )}
      </NavLink>

      {/* Children accordion */}
      {hasChildren && !collapsed && (
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: isOpen ? `${item.children!.length * 52 + 8}px` : "0px",
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div className="ml-4 mt-1 mb-1 border-l-2 border-slate-100 dark:border-slate-800 pl-1 space-y-0.5">
            {item.children!.map((child) => (
              <SidebarNavItem
                key={child.id}
                item={child}
                collapsed={collapsed}
                level={level + 1}
                openMenus={openMenus}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
