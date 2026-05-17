import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Search, Settings2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { referenceOptionsApi, type PaginatedResponse, type ReferenceOption } from '@/lib/api';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

const DEFAULT_FORM = {
  option_group: '',
  value: '',
  label: '',
  description: '',
  meta_json: '{}',
  sort_order: 100,
  active: true,
};

export default function ReferenceOptionsPage() {
  const [result, setResult] = useState<PaginatedResponse<ReferenceOption> | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReferenceOption | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await referenceOptionsApi.list({
        search,
        option_group: groupFilter === 'all' ? undefined : groupFilter,
        page,
        page_size: 50,
      });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải reference options');
    } finally {
      setLoading(false);
    }
  }, [search, groupFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupOptions = useMemo(() => {
    const groups = Array.from(new Set((result?.data || []).map((item) => item.option_group).filter(Boolean)));
    return groups.sort();
  }, [result]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: ReferenceOption) => {
    setEditing(item);
    setForm({
      option_group: item.option_group,
      value: item.value,
      label: item.label,
      description: item.description,
      meta_json: item.meta_json || '{}',
      sort_order: item.sort_order,
      active: item.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await referenceOptionsApi.update(editing.id, form);
        toast.success('Cập nhật reference option thành công');
      } else {
        await referenceOptionsApi.create(form);
        toast.success('Tạo reference option thành công');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu reference option thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật reference option' : 'Tạo reference option mới'}</DialogTitle>
            <DialogDescription>
              Catalog DB-backed cho các dropdown và template runtime, tránh hard-code option trong form quản trị.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Option Group</Label><Input value={form.option_group} onChange={(e) => setForm((f) => ({ ...f, option_group: e.target.value }))} placeholder="client_template" /></div>
            <div><Label>Value</Label><Input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="spa_web" /></div>
            <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="SPA Web" /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value || 100) }))} /></div>
            <div className="md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="md:col-span-2">
              <Label>Meta JSON</Label>
              <textarea
                value={form.meta_json}
                onChange={(e) => setForm((f) => ({ ...f, meta_json: e.target.value }))}
                className="min-h-40 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder='{"app_type":"web_app"}'
              />
            </div>
            <div className="flex items-center gap-5 pt-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="Reference Options"
        subtitle="Quản trị tập option dùng chung cho template, dropdown và catalog mở rộng runtime"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.OPTION_CREATE}>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo group, value, label" className="pl-9" />
          </div>
          <Select value={groupFilter} onValueChange={(value) => { setGroupFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Lọc theo group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả group</SelectItem>
              {groupOptions.map((group) => (
                <SelectItem key={group} value={group}>{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Group / Value</th>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3">Meta</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.data || []).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{item.option_group}</div>
                        <div className="text-xs text-slate-400">{item.value}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{item.label}</div>
                        <div className="text-xs text-slate-400">{item.description || 'Không có mô tả'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="max-w-md truncate">{item.meta_json || '{}'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-emerald-500" />
                          {item.active ? `Active • #${item.sort_order}` : `Inactive • #${item.sort_order}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Guard permission={PERMISSIONS.OPTION_UPDATE}>
                            <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Sửa</Button>
                          </Guard>
                          <Guard permission={PERMISSIONS.OPTION_DELETE}>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-rose-600"
                              onClick={async () => {
                                try {
                                  await referenceOptionsApi.delete(item.id);
                                  toast.success(`Đã xóa ${item.value}`);
                                  fetchData();
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Xóa reference option thất bại');
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Guard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={result?.total || 0}
              page={result?.page || 1}
              pageSize={result?.page_size || 50}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
