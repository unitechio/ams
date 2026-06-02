import React, { useRef, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATIC_MENU, type MenuNode } from "@/menu/menuService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// Get all defined menu URLs to disambiguate active states
const ALL_MENU_URLS = new Set(STATIC_MENU.map(i => i.url).filter(u => u !== "#"));

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
  const [isHovered, setIsHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChildren = !!item.children?.length;
  const isOpen = openMenus[item.id] ?? false;

  const isLinkActive =
    item.url !== "#" &&
    (location.pathname === item.url ||
      (item.url !== "/" &&
        location.pathname.startsWith(item.url + "/") &&
        !ALL_MENU_URLS.has(location.pathname)));

  const isChildActive =
    hasChildren &&
    item.children!.some(
      (c) =>
        location.pathname === c.url ||
        (c.url !== "/" &&
          location.pathname.startsWith(c.url + "/") &&
          !ALL_MENU_URLS.has(location.pathname)),
    );

  const Icon = resolveIcon(item.icon);

  // Handle hover logic for Popover
  const handleMouseEnter = () => {
    if (collapsed && level === 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (collapsed && level === 0) {
      timeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 100); // Small delay to allow moving to popover
    }
  };

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
    if (hasChildren && !collapsed) {
      e.preventDefault();
      onToggle(item.id);
    }
  };

  const itemClasses = cn(
    "flex items-center gap-3 rounded-lg transition-all duration-300 cursor-pointer select-none relative group w-full outline-none",
    level > 0 ? "py-2 px-3 ml-3 text-[13px]" : "py-2.5 px-3 text-[13px]",
    collapsed && level === 0 ? "justify-center px-0 bg-transparent hover:bg-transparent" : "",
    !collapsed && isLinkActive
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200/60 dark:shadow-emerald-950/40"
      : !collapsed && isChildActive && !isLinkActive
        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
        : !collapsed ? "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50" : "",
  );

  const NavItemContent = (
    <div
      className={itemClasses}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center shrink-0 transition-all duration-300 ease-out",
          collapsed && level === 0
            ? cn(
              "w-[30px] h-[30px] rounded-lg border transition-all duration-300",
              isLinkActive
                ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-200/50 dark:shadow-none scale-100"
                : isChildActive
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-100 dark:border-emerald-800/50"
                  : "bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-transparent group-hover:bg-white dark:group-hover:bg-slate-800 group-hover:text-emerald-600 group-hover:border-emerald-100 dark:group-hover:border-emerald-900/50 group-hover:shadow-sm group-hover:scale-105"
            )
            : "w-5 h-5",
        )}
      >
        <Icon className={cn(collapsed && level === 0 ? "w-4 h-4" : "w-[16px] h-[16px]")} />
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
    </div>
  );

  // When collapsed, wrap top-level items in a Popover with HOVER trigger
  if (collapsed && level === 0) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {hasChildren ? (
            <button className="w-full focus:outline-none">{NavItemContent}</button>
          ) : (
            <NavLink to={item.url} className="w-full focus:outline-none">
              {NavItemContent}
            </NavLink>
          )
          }
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={20}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="p-1.5 w-56 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 z-[100]"
        >
          <div className="px-3 py-2.5 mb-1.5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800/50">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shadow-sm">
              <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {item.title}
            </span>
          </div>

          <div className="space-y-1">
            {hasChildren ? (
              item.children!.map((child) => (
                <NavLink
                  key={child.id}
                  to={child.url}
                  className={({ isActive }) => cn(
                    "flex items-center px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 group/sub",
                    isActive
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none"
                      : "text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300"
                  )}
                >
                  <span className="truncate whitespace-nowrap">{child.title}</span>
                </NavLink>
              ))
            ) : (
              <NavLink
                to={item.url}
                className={({ isActive }) => cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none"
                    : "text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-300"
                )}
              >
                <span className="truncate whitespace-nowrap">Truy cập {item.title}</span>
              </NavLink>
            )}
          </div>
        </PopoverContent>

      </Popover>
    );
  }

  return (
    <div className="flex flex-col">
      <NavLink
        to={hasChildren ? "#" : item.url}
        className="w-full"
      >
        {NavItemContent}
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


