import React, { useState, useEffect, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  LayoutDashboard, Plus, Pencil, Trash2,
  Loader2, ChevronDown, ChevronRight, FolderOpen,
  Link2, Save, X
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter, AdminToolbar } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { menusApi, permissionsApi, type ApiMenu, type ApiPermission } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ICON_OPTIONS = [
  'LayoutDashboard', 'Users', 'Shield', 'Key', 'Settings', 'Menu', 'History',
  'Activity', 'FileText', 'Wrench', 'UserPlus', 'ShieldCheck', 'Globe', 'Lock',
  'Bell', 'Database', 'Code2', 'Tag', 'Folder', 'Star',
];

function resolveIcon(name: string) {
  return (LucideIcons as any)[name] || LayoutDashboard;
}

function IconDisplay({ name, className }: { name: string; className?: string }) {
  const Icon = resolveIcon(name);
  return <Icon className={className} />;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
        <FolderOpen className="w-7 h-7 text-slate-300 dark:text-slate-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa có menu nào</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tạo menu đầu tiên để bắt đầu cấu hình sidebar</p>
      </div>
      <Button size="sm" onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg text-white">
        <Plus className="w-4 h-4 mr-1.5" /> Thêm menu đầu tiên
      </Button>
    </div>
  );
}

// ─── Menu tree row ────────────────────────────────────────────────────────────
interface MenuRowProps {
  menu: ApiMenu;
  children?: ApiMenu[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (m: ApiMenu) => void;
  onDelete: (id: number) => void;
  onAddChild: (parentId: number) => void;
}

function MenuRow({ menu, children = [], expanded, onToggle, onEdit, onDelete, onAddChild }: MenuRowProps) {
  const hasChildren = children.length > 0;

  return (
    <>
      <tr className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
        {/* Expand toggle */}
        <td className="w-10 px-3 py-3">
          {hasChildren ? (
            <button
              onClick={onToggle}
              className="w-6 h-6 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors"
            >
              {expanded
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-6" />
          )}
        </td>

        {/* Icon + Title */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
              <IconDisplay name={menu.icon} className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{menu.title}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{menu.url === '#' ? '— nhóm —' : menu.url}</p>
            </div>
          </div>
        </td>

        {/* Permission */}
        <td className="px-3 py-3">
          {menu.permission_code ? (
            <code className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/50">
              {menu.permission_code}
            </code>
          ) : (
            <span className="text-[11px] text-slate-300 dark:text-slate-700 italic">Public</span>
          )}
        </td>

        {/* Order */}
        <td className="px-3 py-3 text-center">
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{menu.sort_order}</span>
        </td>

        {/* Children count */}
        <td className="px-3 py-3 text-center">
          {hasChildren && (
            <Badge variant="secondary" className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-0">
              {children.length}
            </Badge>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAddChild(menu.id)}
              className="h-7 w-7 rounded-md text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              title="Thêm menu con"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(menu)}
              className="h-7 w-7 rounded-md text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              title="Chỉnh sửa"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(menu.id)}
              className="h-7 w-7 rounded-md text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              title="Xóa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Children rows */}
      {hasChildren && expanded && children.map(child => (
        <tr key={child.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors bg-slate-50/30 dark:bg-slate-800/20">
          <td className="px-3 py-2.5" />
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-200 dark:border-slate-800 ml-3">
              <div className="w-7 h-7 rounded-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0">
                <IconDisplay name={child.icon} className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{child.title}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{child.url}</p>
              </div>
            </div>
          </td>
          <td className="px-3 py-2.5">
            {child.permission_code ? (
              <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/50">
                {child.permission_code}
              </code>
            ) : (
              <span className="text-[10px] text-slate-300 dark:text-slate-700 italic">Public</span>
            )}
          </td>
          <td className="px-3 py-2.5 text-center">
            <span className="text-[11px] font-mono text-slate-300 dark:text-slate-600">{child.sort_order}</span>
          </td>
          <td className="px-3 py-2.5" />
          <td className="px-3 py-2.5">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(child)}
                className="h-7 w-7 rounded-md text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(child.id)}
                className="h-7 w-7 rounded-md text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MenusPage() {
  const [menus, setMenus] = useState<ApiMenu[]>([]);
  const [permissions, setPermissions] = useState<ApiPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMenu, setEditingMenu] = useState<ApiMenu | null>(null);
  const [form, setForm] = useState({
    title: '',
    url: '#',
    icon: 'LayoutDashboard',
    sort_order: 10,
    permission_code: '',
    parent_id: undefined as number | undefined,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        menusApi.list({ search, page, page_size: pageSize }),
        permissionsApi.list(),
      ]);
      setMenus(mRes.data);
      setTotal(mRes.total);
      setPermissions(pRes);
      // Auto-expand all root menus
      const roots = mRes.data.filter(m => !m.parent_id).map(m => m.id);
      setExpandedIds(new Set(roots));
    } catch (e: any) {
      toast.error('Lỗi tải dữ liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rootMenus = menus
    .filter(m => !m.parent_id)
    .sort((a, b) => b.sort_order - a.sort_order);

  const filteredRoots = search
    ? menus.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    : rootMenus;

  const getChildren = (parentId: number) =>
    menus.filter(m => m.parent_id === parentId).sort((a, b) => b.sort_order - a.sort_order);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreate = (parentId?: number) => {
    setEditingMenu(null);
    setForm({
      title: '',
      url: parentId ? '' : '#',
      icon: 'LayoutDashboard',
      sort_order: (menus.length + 1) * 10,
      permission_code: '',
      parent_id: parentId,
    });
    setDialogOpen(true);
  };

  const openEdit = (m: ApiMenu) => {
    setEditingMenu(m);
    setForm({
      title: m.title,
      url: m.url,
      icon: m.icon,
      sort_order: m.sort_order,
      permission_code: m.permission_code ?? '',
      parent_id: m.parent_id ?? undefined,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.warning('Vui lòng nhập tiêu đề menu');
    setSaving(true);
    try {
      if (editingMenu) {
        await menusApi.update(editingMenu.id, form);
        toast.success('Cập nhật menu thành công');
      } else {
        await menusApi.create(form);
        toast.success('Thêm menu thành công');
      }
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa menu này? Các menu con cũng sẽ bị xóa.')) return;
    try {
      await menusApi.delete(id);
      toast.success('Đã xóa menu');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Cấu hình hệ thống Menu"
          subtitle="Quản lý cây menu, phân quyền hiển thị và thứ tự sắp xếp trong hệ thống"
          actions={
            <Button
              onClick={() => openCreate()}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-100 dark:shadow-none"
            >
              <Plus className="w-4.5 h-4.5 mr-2" />
              Thêm menu chính
            </Button>
          }
        />

        {/* Toolbar */}
        <AdminToolbar className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <AdminSearchField className="max-w-sm">
            <Input
              placeholder="Tìm kiếm menu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            />
          </AdminSearchField>
          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedIds(new Set(rootMenus.map(m => m.id)))}
              className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs"
            >
              Mở tất cả
            </Button>
          </div>
        </AdminToolbar>

        {/* Table Area */}
        {loading ? (
          <AdminLoadingState className="flex-col gap-3 py-24 rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải cấu trúc menu...</p>
          </AdminLoadingState>
        ) : filteredRoots.length === 0 ? (
          <EmptyState onAdd={() => openCreate()} />
        ) : (
          <AdminCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="w-12 px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider min-w-[240px]">Tiêu đề Menu</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Đường dẫn (URL)</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Menu cha</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-24">Thứ tự</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-24">Mã Icon</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-40">Quyền hạn</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300/50 dark:divide-slate-700/50">
                  {(() => {
                    const renderList: { item: ApiMenu; depth: number }[] = [];
                    const process = (parentId: number | null, depth: number) => {
                      const items = (parentId === null ? rootMenus : getChildren(parentId));
                      items.forEach(it => {
                        renderList.push({ item: it, depth });
                        process(it.id, depth + 1);
                      });
                    };
                    process(null, 0);

                    return renderList.map(({ item, depth }, idx) => {
                      const parent = item.parent_id ? menus.find(m => m.id === item.parent_id) : null;
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "group transition-colors",
                            idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/30 dark:bg-slate-800/20",
                            "hover:bg-emerald-50/80 dark:hover:bg-emerald-900/20"
                          )}
                        >
                          {/* Index */}
                          <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 font-bold font-mono">
                            {idx + 1}
                          </td>

                          {/* Title with indentation */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {depth > 0 && (
                                <span className="text-slate-400/60 font-mono tracking-tighter shrink-0 select-none">
                                  {Array(depth).fill('---').join('')}
                                </span>
                              )}
                              <span className={cn(
                                "text-[13px] transition-colors",
                                depth === 0 ? "font-bold text-slate-900 dark:text-slate-100" : "font-semibold text-slate-700 dark:text-slate-300"
                              )}>
                                {item.title}
                              </span>
                            </div>
                          </td>

                          {/* URL */}
                          <td className="px-4 py-3.5 text-xs font-mono text-slate-500 dark:text-slate-400 font-medium">
                            {item.url === '#' ? (
                              <span className="text-slate-400 dark:text-slate-600 italic"># nhóm</span>
                            ) : item.url}
                          </td>

                          {/* Parent */}
                          <td className="px-4 py-3.5">
                            {parent ? (
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
                                {parent.title}
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Root</span>
                            )}
                          </td>

                          {/* Sort Order */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                              {item.sort_order}
                            </span>
                          </td>

                          {/* Icon */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-200 dark:group-hover:border-emerald-800 transition-all shadow-sm">
                                <IconDisplay name={item.icon} className="w-4 h-4" />
                              </div>
                            </div>
                          </td>

                          {/* Permission */}
                          <td className="px-4 py-3.5">
                            {item.permission_code ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50">
                                  {item.permission_code}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic">Public</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(item)}
                                className="h-8 w-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                title="Chỉnh sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(item.id)}
                                className="h-8 w-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Footer Summary & Pagination */}
            <AdminTableFooter className="px-5 py-3.5 bg-slate-50/60 dark:bg-slate-800/40 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  Hiển thị <span className="text-slate-700 dark:text-slate-300">{menus.length}</span> danh mục menu hệ thống
                </p>
                <div className="flex items-center gap-4 text-[11px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">
                  <span>{rootMenus.length} Root</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <span>{menus.length - rootMenus.length} Children</span>
                </div>
              </div>
              <Pagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </AdminTableFooter>
          </AdminCard>
        )}
      </div>

      {/* ─── Create / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-lg bg-white dark:bg-slate-900">
          {/* Header */}
          <div className="bg-emerald-600 px-6 py-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-semibold">
                  {editingMenu ? 'Chỉnh sửa menu' : 'Thêm menu mới'}
                </DialogTitle>
                <DialogDescription className="text-emerald-100/80 text-xs mt-0.5">
                  {editingMenu ? `Đang sửa: ${editingMenu.title}` : form.parent_id ? 'Menu con — hiển thị trong dropdown' : 'Menu gốc — hiển thị trực tiếp trên sidebar'}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Title + Icon */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Tiêu đề" required>
                  <Input
                    placeholder="Tên hiển thị..."
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500 dark:text-slate-100"
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Icon">
                <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm">
                    <SelectValue placeholder="Chọn icon..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-64">
                    {ICON_OPTIONS.map(icon => (
                      <SelectItem key={icon} value={icon} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <IconDisplay name={icon} className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span>{icon}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* URL */}
            <Field label="Đường dẫn (URL)">
              <Input
                placeholder="/users, /reports, # (nhóm)..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm font-mono focus-visible:ring-emerald-500 dark:text-slate-100"
              />
            </Field>

            {/* Permission + Parent */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quyền hiển thị">
                <Select
                  value={form.permission_code || '__none__'}
                  onValueChange={v => setForm(f => ({ ...f, permission_code: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm dark:text-slate-100">
                    <SelectValue placeholder="Chọn quyền..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-64">
                    <SelectItem value="__none__" className="rounded-lg text-slate-400 italic">Public (mọi người)</SelectItem>
                    {permissions.map(p => (
                      <SelectItem key={p.id} value={p.code} className="rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-semibold">{p.code}</span>
                          <span className="text-[10px] text-slate-400">{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Menu cha">
                <Select
                  value={form.parent_id?.toString() ?? '__root__'}
                  onValueChange={v => setForm(f => ({ ...f, parent_id: v === '__root__' ? undefined : parseInt(v) }))}
                >
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm dark:text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-64">
                    <SelectItem value="__root__" className="rounded-lg">Không có (root)</SelectItem>
                    {menus
                      .filter(m => !m.parent_id && m.id !== editingMenu?.id)
                      .map(m => (
                        <SelectItem key={m.id} value={m.id.toString()} className="rounded-lg">{m.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Sort order */}
            <Field label="Thứ tự (số cao = hiển thị trước)">
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm w-32 dark:text-slate-100"
              />
            </Field>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4 mr-1.5" /> Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 font-medium text-white shadow-sm shadow-emerald-200 dark:shadow-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              {editingMenu ? 'Lưu thay đổi' : 'Tạo menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
