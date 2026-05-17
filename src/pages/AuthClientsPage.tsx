import React, { useCallback, useEffect, useState } from 'react';
import { AppWindow, Copy, KeyRound, Loader2, Plus, RefreshCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clientsApi, type AuthClient, type PaginatedResponse } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

type Mode = 'all' | 'service';

const DEFAULT_FORM = {
  client_id: '',
  client_secret: '',
  name: '',
  description: '',
  app_type: 'web_app',
  public: true,
  pkce_required: false,
  active: true,
  grant_types: 'password,refresh_token',
  redirect_uris: '',
  audiences: 'default-api',
  channels: 'web',
  trusted_types: 'browser',
};

function toPayload(form: typeof DEFAULT_FORM) {
  const split = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean);
  return {
    client_id: form.client_id,
    client_secret: form.client_secret,
    name: form.name,
    description: form.description,
    app_type: form.app_type,
    public: form.public,
    pkce_required: form.pkce_required,
    active: form.active,
    grant_types: split(form.grant_types),
    redirect_uris: split(form.redirect_uris),
    audiences: split(form.audiences),
    channels: split(form.channels),
    trusted_types: split(form.trusted_types),
  };
}

export function AuthClientsManager({ mode = 'all' }: { mode?: Mode }) {
  const [result, setResult] = useState<PaginatedResponse<AuthClient> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuthClient | null>(null);
  const [editing, setEditing] = useState<AuthClient | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const appType = mode === 'service' ? 'internal_service' : undefined;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientsApi.list({ search, app_type: appType, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải auth clients');
    } finally {
      setLoading(false);
    }
  }, [search, appType, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...DEFAULT_FORM,
      app_type: mode === 'service' ? 'internal_service' : 'web_app',
      public: mode === 'service' ? false : true,
      pkce_required: mode === 'service' ? false : true,
      grant_types: mode === 'service' ? 'client_credentials' : 'password,refresh_token',
      redirect_uris: mode === 'service' ? '' : DEFAULT_FORM.redirect_uris,
      audiences: mode === 'service' ? 'payment-api' : 'default-api',
      channels: mode === 'service' ? 'service' : 'web',
      trusted_types: mode === 'service' ? 'server' : 'browser',
    });
    setDialogOpen(true);
  };

  const openEdit = (client: AuthClient) => {
    setEditing(client);
    setForm({
      client_id: client.client_id,
      client_secret: client.client_secret,
      name: client.name,
      description: client.description,
      app_type: client.app_type,
      public: client.public,
      pkce_required: client.pkce_required,
      active: client.active,
      grant_types: client.grant_types.join(','),
      redirect_uris: client.redirect_uris.join(','),
      audiences: client.audiences.join(','),
      channels: client.channels.join(','),
      trusted_types: client.trusted_types.join(','),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editing) {
        await clientsApi.update(editing.id, payload);
        toast.success('Cập nhật auth client thành công');
      } else {
        await clientsApi.create(payload);
        toast.success('Tạo auth client thành công');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu auth client thất bại');
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
          await clientsApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.client_id}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa auth client hoặc service account."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật auth client' : 'Tạo auth client mới'}</DialogTitle>
            <DialogDescription>Quản lý `client_id`, `client_secret`, `redirect URI`, `audience`, `grant type`, `PKCE` và phân loại public/confidential.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Client ID</Label><Input value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} /></div>
            <div><Label>Client Secret</Label><Input value={form.client_secret} onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))} /></div>
            <div><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>App Type</Label>
              <Select value={form.app_type} onValueChange={(value) => setForm(f => ({ ...f, app_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="web_app">Web App</SelectItem>
                  <SelectItem value="mobile_app">Mobile App</SelectItem>
                  <SelectItem value="admin_portal">Admin Portal</SelectItem>
                  <SelectItem value="internal_service">Internal Service</SelectItem>
                  <SelectItem value="partner_api">Partner API</SelectItem>
                  <SelectItem value="third_party_integration">Third-party Integration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Grant Types</Label><Input value={form.grant_types} onChange={(e) => setForm(f => ({ ...f, grant_types: e.target.value }))} placeholder="password,refresh_token,client_credentials" /></div>
            <div><Label>Channels</Label><Input value={form.channels} onChange={(e) => setForm(f => ({ ...f, channels: e.target.value }))} placeholder="web,mobile,service" /></div>
            <div><Label>Redirect URIs</Label><Input value={form.redirect_uris} onChange={(e) => setForm(f => ({ ...f, redirect_uris: e.target.value }))} placeholder="https://app/callback,myapp://oauth/callback" /></div>
            <div><Label>Audiences</Label><Input value={form.audiences} onChange={(e) => setForm(f => ({ ...f, audiences: e.target.value }))} placeholder="payment-api,parking-api" /></div>
            <div><Label>Trusted Types</Label><Input value={form.trusted_types} onChange={(e) => setForm(f => ({ ...f, trusted_types: e.target.value }))} placeholder="browser,mobile,server" /></div>
            <div className="flex items-center gap-5 pt-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.public} onChange={(e) => setForm(f => ({ ...f, public: e.target.checked }))} /> Public client</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.pkce_required} onChange={(e) => setForm(f => ({ ...f, pkce_required: e.target.checked }))} /> PKCE required</label>
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
        title={mode === 'service' ? 'Service Accounts' : 'OAuth Clients'}
        subtitle={mode === 'service' ? 'Machine-to-machine clients cho cronjob, worker, integration và internal service' : 'Quản lý client_id, redirect URI, PKCE, audience và policy theo từng application'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={mode === 'service' ? PERMISSIONS.SERVICE_CREATE : PERMISSIONS.CLIENT_CREATE}>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo client_id, name, app_type" className="pl-9" />
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
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Grant / PKCE</th>
                    <th className="px-4 py-3">Audience</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((client) => (
                    <tr key={client.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{client.client_id}</div>
                        <div className="text-xs text-slate-400">{client.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {client.app_type === 'internal_service' ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <AppWindow className="h-4 w-4 text-slate-400" />}
                          <span>{client.app_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-600">{client.grant_types.join(', ')}</div>
                        <div className="text-xs text-slate-400">{client.public ? 'Public' : 'Confidential'} {client.pkce_required ? '• PKCE' : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{client.audiences.join(', ')}</td>
                      <td className="px-4 py-3 text-xs">{client.channels.join(', ')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(client.client_secret || ''); toast.success('Đã sao chép client secret'); }}>
                            <Copy className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                            <KeyRound className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(client); setStepUpOpen(true); }}>
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

export default function AuthClientsPage() {
  return <AuthClientsManager mode="all" />;
}
