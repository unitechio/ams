import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Search, Pencil, Trash2, Loader2, AlertCircle,
  Shield, Activity, Info, ArrowRight, Settings2, Code2,
  Tag, FileText, ChevronDown, ChevronRight, RefreshCcw,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { permissionsApi, type ApiPermission } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';

// ─── Group color map ──────────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  user: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800/50' },
  role: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', ring: 'ring-violet-200 dark:ring-violet-800/50' },
  permission: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800/50' },
  menu: { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', ring: 'ring-teal-200 dark:ring-teal-800/50' },
  auth: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', ring: 'ring-rose-200 dark:ring-rose-800/50' },
  audit: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-200 dark:ring-orange-800/50' },
  system: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-200 dark:ring-slate-700' },
  setting: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800/50' },
};

function getGroupColor(group: string) {
  return GROUP_COLORS[group.toLowerCase()] ?? GROUP_COLORS.system;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ComponentType<any>; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3 shadow-sm">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none mt-0.5 font-outfit">{value}</p>
      </div>
    </div>
  );
}

// ─── Permission row card ──────────────────────────────────────────────────────
function PermissionCard({
  perm,
  onEdit,
  onAddLine,
  onDeleteLine,
}: {
  perm: ApiPermission;
  onEdit: () => void;
  onDelete: () => void;
  onAddLine: () => void;
  onDeleteLine: (lineId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const gc = getGroupColor(perm.group_name);
  const lineCount = perm.lines?.length ?? 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md dark:hover:shadow-emerald-950/20 transition-shadow duration-200">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Icon */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1', gc.bg, gc.ring)}>
          <Key className={cn('w-5 h-5', gc.text)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{perm.name}</span>
            <Badge
              variant="secondary"
              className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide border-0', gc.bg, gc.text)}
            >
              {perm.group_name}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md border border-emerald-100/70 dark:border-emerald-800/50">
              {perm.code}
            </code>
            {perm.description && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{perm.description}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteLine(perm.id)}
            className="h-8 w-8 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            title="Xóa quyền này"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddLine}
            className="h-8 px-3 rounded-lg text-[12px] font-medium border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Gán endpoint
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(e => !e)}
            className="h-8 px-2.5 rounded-lg text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="mr-1 text-slate-400 dark:text-slate-600">{lineCount}</span>
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Lines accordion */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/60 dark:bg-slate-900/50">
          {lineCount === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-slate-400 dark:text-slate-500 italic">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Chưa có endpoint nào được liên kết với quyền này
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {perm.lines!.map(line => (
                <div
                  key={line.id}
                  className="group/line relative flex flex-col gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-150"
                >
                  {/* Delete button */}
                  <button
                    onClick={() => onDeleteLine(line.id)}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950 text-red-400 dark:text-red-500 flex items-center justify-center opacity-0 group-hover/line:opacity-100 transition-opacity hover:bg-red-500 dark:hover:bg-red-600 hover:text-white"
                    title="Xóa liên kết"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Backend Handler
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <code className="text-[11px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-100/70 dark:border-blue-800/50 font-semibold">
                      {line.controller}
                    </code>
                    <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />
                    <code className="text-[11px] font-mono bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-100/70 dark:border-emerald-800/50 font-semibold">
                      {line.action}
                    </code>
                  </div>

                  {line.note && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic leading-relaxed line-clamp-2">
                      {line.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Form field helper ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<ApiPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPerm, setCurrentPerm] = useState<ApiPermission | null>(null);
  const [editingPerm, setEditingPerm] = useState<ApiPermission | null>(null);

  const [form, setForm] = useState({ code: '', name: '', description: '', group_name: '' });
  const [lineForm, setLineForm] = useState({ controller: '', action: '', note: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await permissionsApi.list();
      setPermissions(data);
    } catch (e: any) {
      toast.error('Lỗi tải danh sách: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived
  const groups = Array.from(new Set(permissions.map(p => p.group_name))).sort();
  const filtered = permissions.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.group_name.toLowerCase().includes(q);
    const matchGroup = !groupFilter || p.group_name === groupFilter;
    return matchSearch && matchGroup;
  });
  const pageSize = 12;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalLines = permissions.reduce((s, p) => s + (p.lines?.length ?? 0), 0);

  // Handlers
  const openCreate = () => {
    setEditingPerm(null);
    setForm({ code: '', name: '', description: '', group_name: 'system' });
    setDialogOpen(true);
  };

  const openEdit = (p: ApiPermission) => {
    setEditingPerm(p);
    setForm({ code: p.code, name: p.name, description: p.description || '', group_name: p.group_name });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) return toast.warning('Vui lòng điền đủ mã và tên quyền');
    setSaving(true);
    try {
      if (editingPerm) {
        await permissionsApi.update(editingPerm.id, form);
      } else {
        // Frontend check for duplicate code
        const exists = permissions.some(p => p.code.toLowerCase() === form.code.toLowerCase());
        if (exists) {
          toast.error(`Mã quyền '${form.code}' đã tồn tại trong hệ thống`);
          setSaving(false);
          return;
        }
        await permissionsApi.create(form);
      }
      toast.success(editingPerm ? 'Cập nhật thành công' : 'Tạo quyền hạn thành công');
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openAddLine = (p: ApiPermission) => {
    setCurrentPerm(p);
    setLineForm({ controller: '', action: '', note: '' });
    setLineDialogOpen(true);
  };

  const handleAddLine = async () => {
    if (!currentPerm || !lineForm.controller || !lineForm.action)
      return toast.warning('Vui lòng nhập Controller và Action');
    setSaving(true);
    try {
      await permissionsApi.addLine(currentPerm.code, lineForm);
      toast.success('Gán endpoint thành công');
      setLineDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xác nhận xóa quyền này khỏi registry?')) return;
    try {
      await permissionsApi.delete(id);
      toast.success('Đã xóa quyền');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteLine = async (code: string, lineID: number) => {
    if (!confirm('Xóa liên kết endpoint này?')) return;
    try {
      await permissionsApi.deleteLine(code, lineID);
      toast.success('Đã xóa liên kết');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="API Permission Registry"
        subtitle="Định nghĩa mã quyền hạn và liên kết trực tiếp tới handler backend"
        actions={
          <Button
            size="sm"
            onClick={openCreate}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-medium shadow-sm shadow-emerald-200 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tạo quyền mới
          </Button>
        }
      />

      <div className="space-y-5">

        {/* Stat bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Tổng quyền" value={permissions.length} icon={Shield} color="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Nhóm quyền" value={groups.length} icon={Tag} color="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" />
          <StatCard label="Endpoints" value={totalLines} icon={Code2} color="bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400" />
          <StatCard label="Hiển thị" value={filtered.length} icon={FileText} color="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <Input
              placeholder="Tìm theo mã, tên, nhóm..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500"
            />
          </div>

          {/* Group filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setGroupFilter(''); setPage(1); }}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-semibold transition-colors',
                groupFilter === '' 
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              Tất cả
            </button>
            {groups.map(g => {
              const gc = getGroupColor(g);
              return (
                <button
                  key={g}
                  onClick={() => {
                    setGroupFilter(prev => prev === g ? '' : g);
                    setPage(1);
                  }}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-semibold transition-all ring-1',
                    groupFilter === g
                      ? cn(gc.bg, gc.text, gc.ring)
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 ring-transparent'
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>

          <div className="sm:ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Đang tải dữ liệu...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <Shield className="w-10 h-10 text-slate-200 dark:text-slate-800" />
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Không tìm thấy quyền hạn nào</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setGroupFilter(''); }} className="rounded-lg dark:border-slate-800">
              Xóa bộ lọc
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2.5">
              {paginated.map(p => (
                <PermissionCard
                  key={`${p.id}-${p.code}`}
                  perm={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => handleDelete(p.id)}
                  onAddLine={() => openAddLine(p)}
                  onDeleteLine={lineId => handleDeleteLine(p.code, lineId)}
                />
              ))}
            </div>
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Pagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Permission Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-md bg-white dark:bg-slate-900">
          {/* Colored header */}
          <div className="bg-emerald-600 px-6 py-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-semibold">
                  {editingPerm ? 'Cập nhật Permission' : 'Tạo mã quyền hạn mới'}
                </DialogTitle>
                <DialogDescription className="text-emerald-100/80 text-xs mt-0.5">
                  {editingPerm ? `Đang sửa: ${editingPerm.code}` : 'Định nghĩa mã quyền để gán cho Role & Menu'}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <Field label="Mã định danh (Code) *">
              <Input
                placeholder="user.create, report.view, ..."
                value={form.code}
                disabled={!!editingPerm}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase().trim() }))}
                className={cn(
                  "h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 font-mono text-sm focus-visible:ring-emerald-500 disabled:opacity-60",
                  !editingPerm && form.code && permissions.some(p => p.code.toLowerCase() === form.code.toLowerCase()) && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {!editingPerm && form.code && permissions.some(p => p.code.toLowerCase() === form.code.toLowerCase()) && (
                <p className="text-[10px] text-red-500 font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                  Mã này đã tồn tại trong hệ thống
                </p>
              )}
            </Field>
            <Field label="Tên hiển thị *">
              <Input
                placeholder="Tên dễ đọc..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nhóm (Group)">
                <Input
                  placeholder="user, auth, sys..."
                  value={form.group_name}
                  onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                  list="group-list"
                  className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500"
                />
                <datalist id="group-list">
                  {groups.map(g => <option key={g} value={g} />)}
                </datalist>
                <p className="text-[10px] text-slate-400 mt-1 italic">Chọn nhóm đã có hoặc gõ tên nhóm mới</p>
              </Field>
              <Field label="Mô tả">
                <Input
                  placeholder="Mô tả ngắn..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500"
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-medium shadow-sm shadow-emerald-200 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : editingPerm ? <Settings2 className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {editingPerm ? 'Lưu thay đổi' : 'Tạo quyền'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Line Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-md bg-white dark:bg-slate-900">
          <div className="bg-emerald-600 px-6 py-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-semibold">
                  Gán Backend Endpoint
                </DialogTitle>
                <DialogDescription className="text-blue-100/80 text-xs mt-0.5">
                  Quyền:{' '}
                  <code className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">
                    {currentPerm?.code}
                  </code>
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Field label="Controller (Handler) *">
              <Input
                placeholder="UserHandler, RoleHandler, ..."
                value={lineForm.controller}
                onChange={e => setLineForm(f => ({ ...f, controller: e.target.value }))}
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 font-mono text-sm focus-visible:ring-emerald-500"
              />
            </Field>
            <Field label="Action (Method) *">
              <Input
                placeholder="List, Get, Create, Update, Delete..."
                value={lineForm.action}
                onChange={e => setLineForm(f => ({ ...f, action: e.target.value }))}
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 font-mono text-sm focus-visible:ring-emerald-500"
              />
            </Field>
            <Field label="Ghi chú nghiệp vụ">
              <Input
                placeholder="Quyền này dùng để..."
                value={lineForm.note}
                onChange={e => setLineForm(f => ({ ...f, note: e.target.value }))}
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500"
              />
            </Field>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setLineDialogOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddLine}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-medium text-white shadow-sm shadow-emerald-200 dark:shadow-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Lưu liên kết
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
