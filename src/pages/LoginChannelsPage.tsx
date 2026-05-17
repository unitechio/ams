import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Search, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { loginChannelsApi, referenceOptionsApi, type LoginChannel, type PaginatedResponse, type ReferenceOption } from '@/lib/api';
import { toast } from 'sonner';

const DEFAULT_FORM = {
  code: '',
  name: '',
  description: '',
  risk_level: 'medium',
  require_mfa: false,
  allow_password: true,
  allow_sso: true,
  trusted_device_ttl_hours: 720,
  session_ttl_minutes: 1440,
  active: true,
};

export default function LoginChannelsPage() {
  const [result, setResult] = useState<PaginatedResponse<LoginChannel> | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOption[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [editing, setEditing] = useState<LoginChannel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoginChannel | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loginChannelsApi.list({ search, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải login channels');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    referenceOptionsApi.list({ option_group: 'channel_risk_level', active: 'true', page: 1, page_size: 100 })
      .then((res) => setReferenceOptions(res.data || []))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Không thể tải risk-level options'));
  }, []);

  const riskLevelOptions = referenceOptions.filter(item => item.option_group === 'channel_risk_level');

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (channel: LoginChannel) => {
    setEditing(channel);
    setForm({
      code: channel.code,
      name: channel.name,
      description: channel.description,
      risk_level: channel.risk_level,
      require_mfa: channel.require_mfa,
      allow_password: channel.allow_password,
      allow_sso: channel.allow_sso,
      trusted_device_ttl_hours: channel.trusted_device_ttl_hours,
      session_ttl_minutes: channel.session_ttl_minutes,
      active: channel.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await loginChannelsApi.update(editing.id, form);
        toast.success('Cập nhật login channel thành công');
      } else {
        await loginChannelsApi.create(form);
        toast.success('Tạo login channel thành công');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu login channel thất bại');
    } finally {
      setSaving(false);
    }
  };

  const rows = result?.data || [];

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!deleteTarget) return;
          await loginChannelsApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.code}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa login channel hoặc thay đổi channel policy."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật login channel' : 'Tạo login channel mới'}</DialogTitle>
            <DialogDescription>Tách policy theo bề mặt truy cập: MFA, risk level, trusted device TTL, session TTL, password/SSO enablement.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} placeholder="web / mobile / partner" /></div>
            <div><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label>Risk Level</Label>
              <Select value={form.risk_level} onValueChange={(value) => setForm(f => ({ ...f, risk_level: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {riskLevelOptions.map(option => (
                    <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Trusted Device TTL (hours)</Label><Input type="number" value={form.trusted_device_ttl_hours} onChange={(e) => setForm(f => ({ ...f, trusted_device_ttl_hours: Number(e.target.value) || 0 }))} /></div>
            <div><Label>Session TTL (minutes)</Label><Input type="number" value={form.session_ttl_minutes} onChange={(e) => setForm(f => ({ ...f, session_ttl_minutes: Number(e.target.value) || 0 }))} /></div>
            <div className="flex flex-wrap items-center gap-5 pt-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.require_mfa} onChange={(e) => setForm(f => ({ ...f, require_mfa: e.target.checked }))} /> Require MFA</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_password} onChange={(e) => setForm(f => ({ ...f, allow_password: e.target.checked }))} /> Allow password</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_sso} onChange={(e) => setForm(f => ({ ...f, allow_sso: e.target.checked }))} /> Allow SSO</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} /> Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="Login Channels"
        subtitle="Tách biệt bề mặt đăng nhập khỏi OAuth client để quản lý MFA, risk level và session policy theo channel"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.CHANNEL_CREATE}>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo code, name, description" className="pl-9" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3">TTL</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((channel) => (
                    <tr key={channel.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{channel.code}</div>
                        <div className="text-xs text-slate-400">{channel.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Workflow className="h-4 w-4 text-slate-400" />
                          <span>{channel.risk_level}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{channel.allow_password ? 'Password' : 'No password'} {channel.allow_sso ? '• SSO' : ''}</div>
                        <div>{channel.require_mfa ? 'MFA required' : 'MFA optional'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>Trusted: {channel.trusted_device_ttl_hours}h</div>
                        <div>Session: {channel.session_ttl_minutes}m</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className={channel.active ? 'text-emerald-600' : 'text-slate-400'}>{channel.active ? 'Active' : 'Disabled'}</span>
                          <span className={channel.require_mfa ? 'text-violet-600' : 'text-slate-400'}>{channel.require_mfa ? 'Step-up' : 'Standard'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(channel)}>
                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(channel); setStepUpOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result && result.total > result.page_size && (
              <div className="border-t border-slate-100 px-4 py-3">
                <Pagination total={result.total} page={result.page} pageSize={result.page_size} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
