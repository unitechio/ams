import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppWindow, Copy, KeyRound, Loader2, Plus, RefreshCcw, RotateCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clientsApi, loginChannelsApi, serviceAccountsApi, type AuthClient, type LoginChannel, type PaginatedResponse } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

type Mode = 'all' | 'service';
type StepUpAction =
  | { type: 'delete'; client: AuthClient }
  | { type: 'rotate'; client: AuthClient }
  | null;

const TEMPLATE_OPTIONS = [
  { value: 'spa_web', label: 'SPA Web', appType: 'web_app', public: true, channels: ['web'], grants: 'authorization_code,refresh_token', trusted: 'browser', pkce: true, audience: 'web-api' },
  { value: 'crm_portal', label: 'CRM Portal', appType: 'admin_portal', public: false, channels: ['crm', 'web'], grants: 'authorization_code,refresh_token', trusted: 'browser,desktop', pkce: false, audience: 'crm-api' },
  { value: 'mobile_pkce', label: 'Mobile PKCE', appType: 'mobile_app', public: true, channels: ['mobile'], grants: 'authorization_code,refresh_token', trusted: 'mobile', pkce: true, audience: 'mobile-api' },
  { value: 'kiosk_public', label: 'Kiosk', appType: 'kiosk', public: true, channels: ['kiosk'], grants: 'authorization_code,refresh_token', trusted: 'device,browser', pkce: true, audience: 'kiosk-api' },
  { value: 'service_m2m', label: 'Internal Service', appType: 'internal_service', public: false, channels: ['service'], grants: 'client_credentials', trusted: 'server', pkce: false, audience: 'internal-api' },
  { value: 'partner_oidc', label: 'Partner Portal', appType: 'partner_api', public: false, channels: ['partner'], grants: 'authorization_code,refresh_token', trusted: 'browser,server', pkce: false, audience: 'partner-api' },
  { value: 'custom', label: 'Custom', appType: 'web_app', public: true, channels: ['web'], grants: 'authorization_code,refresh_token', trusted: 'browser', pkce: true, audience: 'default-api' },
] as const;

const DEFAULT_FORM = {
  client_id: '',
  client_secret: '',
  name: '',
  description: '',
  app_type: 'web_app',
  client_template: 'spa_web',
  environment: 'prod',
  domain_group: 'core',
  owner_team: '',
  public: true,
  pkce_required: true,
  active: true,
  legacy_password_grant: false,
  approval_status: 'approved',
  grant_types: 'authorization_code,refresh_token',
  redirect_uris: '',
  audiences: 'web-api',
  channels: ['web'] as string[],
  trusted_types: 'browser',
  tags: 'portal,spa',
};

function split(value: string) {
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

function toPayload(form: typeof DEFAULT_FORM) {
  return {
    client_id: form.client_id.trim(),
    client_secret: form.client_secret.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    app_type: form.app_type,
    client_template: form.client_template,
    environment: form.environment,
    domain_group: form.domain_group.trim(),
    owner_team: form.owner_team.trim(),
    public: form.public,
    pkce_required: form.pkce_required,
    active: form.active,
    legacy_password_grant: form.legacy_password_grant,
    approval_status: form.approval_status,
    grant_types: split(form.grant_types),
    redirect_uris: split(form.redirect_uris),
    audiences: split(form.audiences),
    channels: form.channels,
    trusted_types: split(form.trusted_types),
    tags: split(form.tags),
  };
}

function secretStatus(client: AuthClient) {
  if (client.public) return 'Public / no secret';
  if (!client.secret_expires_at) return `v${client.secret_version}`;
  const expiresAt = new Date(client.secret_expires_at);
  const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Expired v${client.secret_version}`;
  return `v${client.secret_version} • ${diffDays}d left`;
}

export function AuthClientsManager({ mode = 'all' }: { mode?: Mode }) {
  const [result, setResult] = useState<PaginatedResponse<AuthClient> | null>(null);
  const [channels, setChannels] = useState<LoginChannel[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [editing, setEditing] = useState<AuthClient | null>(null);
  const [stepUpAction, setStepUpAction] = useState<StepUpAction>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const appType = mode === 'service' ? 'internal_service' : undefined;
  const clientApi = mode === 'service' ? serviceAccountsApi : clientsApi;
  const channelOptions = useMemo(() => channels.filter(item => item.active), [channels]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = mode === 'service'
        ? await serviceAccountsApi.list({ search, page, page_size: 20 })
        : await clientsApi.list({ search, app_type: appType, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải auth clients');
    } finally {
      setLoading(false);
    }
  }, [search, appType, page, mode]);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await loginChannelsApi.list({ page: 1, page_size: 100 });
      setChannels(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải login channels');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const applyTemplate = (templateValue: string) => {
    const tpl = TEMPLATE_OPTIONS.find(item => item.value === templateValue) || TEMPLATE_OPTIONS[0];
    setForm(prev => ({
      ...prev,
      client_template: tpl.value,
      app_type: tpl.appType,
      public: tpl.public,
      pkce_required: tpl.pkce,
      grant_types: tpl.grants,
      audiences: tpl.audience,
      channels: [...tpl.channels],
      trusted_types: tpl.trusted,
      tags: prev.tags || tpl.label.toLowerCase().replace(/\s+/g, ','),
      legacy_password_grant: false,
      client_secret: tpl.public ? '' : prev.client_secret,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    const template = mode === 'service' ? 'service_m2m' : 'spa_web';
    setForm({
      ...DEFAULT_FORM,
      client_template: template,
      app_type: template === 'service_m2m' ? 'internal_service' : 'web_app',
      public: template !== 'service_m2m',
      pkce_required: template !== 'service_m2m',
      grant_types: template === 'service_m2m' ? 'client_credentials' : 'authorization_code,refresh_token',
      audiences: template === 'service_m2m' ? 'internal-api' : 'web-api',
      channels: template === 'service_m2m' ? ['service'] : ['web'],
      trusted_types: template === 'service_m2m' ? 'server' : 'browser',
      tags: template === 'service_m2m' ? 'service,internal' : 'portal,spa',
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
      client_template: client.client_template || 'custom',
      environment: client.environment || 'prod',
      domain_group: client.domain_group || 'core',
      owner_team: client.owner_team || '',
      public: client.public,
      pkce_required: client.pkce_required,
      active: client.active,
      legacy_password_grant: client.legacy_password_grant,
      approval_status: client.approval_status || 'approved',
      grant_types: client.grant_types.join(','),
      redirect_uris: client.redirect_uris.join(','),
      audiences: client.audiences.join(','),
      channels: client.channels,
      trusted_types: client.trusted_types.join(','),
      tags: client.tags.join(','),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editing) {
        await clientApi.update(editing.id, payload);
        toast.success('Cập nhật auth client thành công');
      } else {
        await clientApi.create(payload);
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

  const toggleChannel = (code: string) => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels.includes(code)
        ? prev.channels.filter(item => item !== code)
        : [...prev.channels, code],
    }));
  };

  const rows = result?.data || [];

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!stepUpAction) return;
          if (stepUpAction.type === 'delete') {
            await clientApi.delete(stepUpAction.client.id);
            toast.success(`Đã xóa ${stepUpAction.client.client_id}`);
          } else {
            const updated = await clientApi.rotateSecret(stepUpAction.client.id);
            toast.success(`Đã rotate client secret cho ${updated.client_id}`);
          }
          setStepUpAction(null);
          fetchData();
        }}
        description={stepUpAction?.type === 'rotate'
          ? 'Xác thực lại để rotate client secret và tăng secret version.'
          : 'Xác thực lại để xóa auth client hoặc service account.'}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật auth client' : 'Tạo auth client mới'}</DialogTitle>
            <DialogDescription>
              Quản lý `client_id`, public/confidential boundary, redirect URI, audience, channel mapping, approval status và secret lifecycle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Client Template</Label>
              <Select value={form.client_template} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={(value) => setForm(f => ({ ...f, environment: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Dev</SelectItem>
                  <SelectItem value="stg">Staging</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Client ID</Label><Input value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} placeholder="tenant.app.env" /></div>
            <div><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Owner Team</Label><Input value={form.owner_team} onChange={(e) => setForm(f => ({ ...f, owner_team: e.target.value }))} placeholder="identity-platform" /></div>
            <div><Label>Domain Group</Label><Input value={form.domain_group} onChange={(e) => setForm(f => ({ ...f, domain_group: e.target.value }))} placeholder="crm, payments, partner" /></div>
            <div>
              <Label>App Type</Label>
              <Select value={form.app_type} onValueChange={(value) => setForm(f => ({ ...f, app_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="web_app">Web App</SelectItem>
                  <SelectItem value="mobile_app">Mobile App</SelectItem>
                  <SelectItem value="admin_portal">Admin Portal</SelectItem>
                  <SelectItem value="kiosk">Kiosk</SelectItem>
                  <SelectItem value="internal_service">Internal Service</SelectItem>
                  <SelectItem value="partner_api">Partner API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Approval Status</Label>
              <Select value={form.approval_status} onValueChange={(value) => setForm(f => ({ ...f, approval_status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending approval</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Grant Types</Label><Input value={form.grant_types} onChange={(e) => setForm(f => ({ ...f, grant_types: e.target.value }))} placeholder="authorization_code,refresh_token" /></div>
            <div><Label>Audiences</Label><Input value={form.audiences} onChange={(e) => setForm(f => ({ ...f, audiences: e.target.value }))} placeholder="payment-api,parking-api" /></div>
            <div><Label>Redirect URIs</Label><Input value={form.redirect_uris} onChange={(e) => setForm(f => ({ ...f, redirect_uris: e.target.value }))} placeholder="https://app/callback,myapp://oauth/callback" /></div>
            <div><Label>Trusted Types</Label><Input value={form.trusted_types} onChange={(e) => setForm(f => ({ ...f, trusted_types: e.target.value }))} placeholder="browser,mobile,server" /></div>
            <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="crm,partner,prod" /></div>
            <div><Label>Client Secret</Label><Input value={form.client_secret} disabled={form.public} onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))} placeholder={form.public ? 'Public client không dùng secret' : 'secret sẽ tự sinh nếu để trống'} /></div>
            <div className="space-y-2">
              <Label>Login Channels</Label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                {channelOptions.map(channel => (
                  <label key={channel.id} className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.channels.includes(channel.code)}
                      onChange={() => toggleChannel(channel.code)}
                    />
                    <span>{channel.code}</span>
                    <span className="text-xs text-slate-400">({channel.risk_level})</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-5 pt-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.public} onChange={(e) => setForm(f => ({ ...f, public: e.target.checked, client_secret: e.target.checked ? '' : f.client_secret }))} /> Public client</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.pkce_required} onChange={(e) => setForm(f => ({ ...f, pkce_required: e.target.checked }))} /> PKCE required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.legacy_password_grant} onChange={(e) => setForm(f => ({ ...f, legacy_password_grant: e.target.checked }))} /> Legacy password grant</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} /> Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving || form.channels.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title={mode === 'service' ? 'Service Accounts' : 'OAuth Clients'}
        subtitle={mode === 'service'
          ? 'Machine-to-machine clients cho cronjob, worker, integration và internal API'
          : 'Tách client khỏi login channel để quản lý approval, audience, redirect URI, template và secret lifecycle theo từng application'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { fetchData(); fetchChannels(); }}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
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
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo client_id, name, owner team, domain group" className="pl-9" />
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
                    <th className="px-4 py-3">Template / Scope</th>
                    <th className="px-4 py-3">Grant / Security</th>
                    <th className="px-4 py-3">Audience / Channel</th>
                    <th className="px-4 py-3">Approval / Secret</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((client) => (
                    <tr key={client.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-800">{client.client_id}</div>
                        <div className="text-xs text-slate-500">{client.name}</div>
                        <div className="text-[11px] text-slate-400">{client.domain_group} • {client.environment} • {client.owner_team || 'unassigned'}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          {client.app_type === 'internal_service' ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <AppWindow className="h-4 w-4 text-slate-400" />}
                          <span>{client.client_template || client.app_type}</span>
                        </div>
                        <div className="mt-1">{client.tags.join(', ') || 'no tags'}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-600">
                        <div>{client.grant_types.join(', ')}</div>
                        <div className="mt-1 text-slate-400">
                          {client.public ? 'Public' : 'Confidential'}
                          {client.pkce_required ? ' • PKCE' : ''}
                          {client.legacy_password_grant ? ' • Legacy password' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-600">
                        <div>{client.audiences.join(', ')}</div>
                        <div className="mt-1 text-slate-400">{client.channels.join(', ')}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-600">
                        <div className={client.approval_status === 'approved' ? 'text-emerald-600' : client.approval_status === 'pending' ? 'text-amber-600' : 'text-red-500'}>
                          {client.approval_status}
                        </div>
                        <div className="mt-1 text-slate-400">{secretStatus(client)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(client.client_secret || ''); toast.success('Đã sao chép client secret'); }} disabled={client.public}>
                            <Copy className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                            <KeyRound className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setStepUpAction({ type: 'rotate', client }); setStepUpOpen(true); }} disabled={client.public}>
                            <RotateCw className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setStepUpAction({ type: 'delete', client }); setStepUpOpen(true); }}>
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

const AuthClientsPage: React.FC = () => <AuthClientsManager />;

export default AuthClientsPage;
