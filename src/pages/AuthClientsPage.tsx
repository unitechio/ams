import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppWindow, Bot, Copy, KeyRound, Loader2, Plus, RefreshCcw, RotateCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clientsApi, loginChannelsApi, referenceOptionsApi, serviceAccountsApi, type AuthClient, type LoginChannel, type PaginatedResponse, type ReferenceOption } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

type Mode = 'all' | 'service';
type StepUpAction =
  | { type: 'delete'; client: AuthClient }
  | { type: 'rotate'; client: AuthClient }
  | null;

type TemplateMeta = {
  app_type?: string;
  public?: boolean;
  channels?: string[];
  grants?: string[];
  trusted_types?: string[];
  pkce_required?: boolean;
  audiences?: string[];
  tags?: string[];
};

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

function parseTemplateMeta(option?: ReferenceOption): TemplateMeta {
  if (!option?.meta_json) return {};
  try {
    return JSON.parse(option.meta_json) as TemplateMeta;
  } catch {
    return {};
  }
}

function toPayload(form: typeof DEFAULT_FORM, mode: Mode) {
  const isService = mode === 'service';
  return {
    client_id: form.client_id.trim(),
    client_secret: form.client_secret.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    app_type: isService ? 'internal_service' : form.app_type,
    client_template: form.client_template,
    environment: form.environment,
    domain_group: form.domain_group.trim(),
    owner_team: form.owner_team.trim(),
    public: isService ? false : form.public,
    pkce_required: isService ? false : form.pkce_required,
    active: form.active,
    legacy_password_grant: isService ? false : form.legacy_password_grant,
    approval_status: form.approval_status,
    grant_types: isService ? ['client_credentials'] : split(form.grant_types),
    redirect_uris: isService ? [] : split(form.redirect_uris),
    audiences: split(form.audiences),
    channels: isService ? ['service'] : form.channels,
    trusted_types: isService ? ['server'] : split(form.trusted_types),
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
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOption[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [editing, setEditing] = useState<AuthClient | null>(null);
  const [stepUpAction, setStepUpAction] = useState<StepUpAction>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const isServiceMode = mode === 'service';
  const appType = isServiceMode ? 'internal_service' : undefined;
  const clientApi = isServiceMode ? serviceAccountsApi : clientsApi;
  const channelOptions = useMemo(() => channels.filter(item => item.active), [channels]);
  const optionsByGroup = useMemo(() => {
    return referenceOptions.reduce<Record<string, ReferenceOption[]>>((acc, item) => {
      if (!acc[item.option_group]) acc[item.option_group] = [];
      acc[item.option_group].push(item);
      return acc;
    }, {});
  }, [referenceOptions]);

  const templateOptions = useMemo(() => {
    const items = optionsByGroup.client_template || [];
    return items.filter((item) => isServiceMode
      ? parseTemplateMeta(item).app_type === 'internal_service'
      : parseTemplateMeta(item).app_type !== 'internal_service');
  }, [optionsByGroup, isServiceMode]);

  const environmentOptions = optionsByGroup.client_environment || [];
  const appTypeOptions = optionsByGroup.client_app_type || [];
  const approvalOptions = optionsByGroup.client_approval_status || [];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = isServiceMode
        ? await serviceAccountsApi.list({ search, page, page_size: 20 })
        : await clientsApi.list({ search, app_type: appType, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải auth clients');
    } finally {
      setLoading(false);
    }
  }, [search, appType, page, isServiceMode]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [channelRes, optionRes] = await Promise.all([
        loginChannelsApi.list({ page: 1, page_size: 100 }),
        referenceOptionsApi.list({ page: 1, page_size: 500, active: 'true' }),
      ]);
      setChannels(channelRes.data || []);
      setReferenceOptions(optionRes.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải option metadata');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const applyTemplate = useCallback((templateValue: string) => {
    const selected = templateOptions.find(item => item.value === templateValue) || templateOptions[0];
    const meta = parseTemplateMeta(selected);
    setForm(prev => ({
      ...prev,
      client_template: selected?.value || prev.client_template,
      app_type: meta.app_type || prev.app_type,
      public: isServiceMode ? false : meta.public ?? prev.public,
      pkce_required: isServiceMode ? false : meta.pkce_required ?? prev.pkce_required,
      grant_types: (meta.grants || split(prev.grant_types)).join(','),
      audiences: (meta.audiences || split(prev.audiences)).join(','),
      channels: isServiceMode ? ['service'] : (meta.channels || prev.channels),
      trusted_types: (meta.trusted_types || split(prev.trusted_types)).join(','),
      tags: (meta.tags || split(prev.tags)).join(','),
      legacy_password_grant: false,
      client_secret: (isServiceMode || meta.public === false) ? prev.client_secret : '',
    }));
  }, [templateOptions, isServiceMode]);

  const openCreate = useCallback(() => {
    setEditing(null);
    const preferredTemplate = templateOptions[0]?.value || (isServiceMode ? 'service_m2m' : 'spa_web');
    setForm({
      ...DEFAULT_FORM,
      client_template: preferredTemplate,
      app_type: isServiceMode ? 'internal_service' : 'web_app',
      public: !isServiceMode,
      pkce_required: !isServiceMode,
      grant_types: isServiceMode ? 'client_credentials' : 'authorization_code,refresh_token',
      audiences: isServiceMode ? 'internal-api' : 'web-api',
      channels: isServiceMode ? ['service'] : ['web'],
      trusted_types: isServiceMode ? 'server' : 'browser',
      tags: isServiceMode ? 'service,internal' : 'portal,spa',
    });
    setDialogOpen(true);
    setTimeout(() => applyTemplate(preferredTemplate), 0);
  }, [applyTemplate, isServiceMode, templateOptions]);

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
      const payload = toPayload(form, mode);
      if (editing) {
        await clientApi.update(editing.id, payload);
        toast.success(isServiceMode ? 'Cập nhật service account thành công' : 'Cập nhật auth client thành công');
      } else {
        await clientApi.create(payload);
        toast.success(isServiceMode ? 'Tạo service account thành công' : 'Tạo auth client thành công');
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
            <DialogTitle>{editing ? (isServiceMode ? 'Cập nhật service account' : 'Cập nhật auth client') : (isServiceMode ? 'Tạo service account mới' : 'Tạo auth client mới')}</DialogTitle>
            <DialogDescription>
              {isServiceMode
                ? 'Service account dùng cho machine-to-machine, luôn confidential, grant mặc định là client_credentials và không dùng redirect URI.'
                : 'Quản lý client_id, boundary public/confidential, redirect URI, audience, channel mapping, approval status và secret lifecycle.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Client Template</Label>
              <Select value={form.client_template} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templateOptions.map(option => (
                    <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Environment</Label>
              <Select value={form.environment} onValueChange={(value) => setForm(f => ({ ...f, environment: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {environmentOptions.map(option => (
                    <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Client ID</Label><Input value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} placeholder="tenant.app.env" /></div>
            <div><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Owner Team</Label><Input value={form.owner_team} onChange={(e) => setForm(f => ({ ...f, owner_team: e.target.value }))} placeholder="identity-platform" /></div>
            <div><Label>Domain Group</Label><Input value={form.domain_group} onChange={(e) => setForm(f => ({ ...f, domain_group: e.target.value }))} placeholder="crm, payments, partner" /></div>
            {isServiceMode ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                App Type cố định: <span className="font-semibold text-slate-800">internal_service</span>
              </div>
            ) : (
              <div>
                <Label>App Type</Label>
                <Select value={form.app_type} onValueChange={(value) => setForm(f => ({ ...f, app_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {appTypeOptions.map(option => (
                      <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Approval Status</Label>
              <Select value={form.approval_status} onValueChange={(value) => setForm(f => ({ ...f, approval_status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {approvalOptions.map(option => (
                    <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Mô tả</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Grant Types</Label><Input value={form.grant_types} disabled={isServiceMode} onChange={(e) => setForm(f => ({ ...f, grant_types: e.target.value }))} placeholder="authorization_code,refresh_token" /></div>
            <div><Label>Audiences</Label><Input value={form.audiences} onChange={(e) => setForm(f => ({ ...f, audiences: e.target.value }))} placeholder="payment-api,parking-api" /></div>
            {!isServiceMode && <div><Label>Redirect URIs</Label><Input value={form.redirect_uris} onChange={(e) => setForm(f => ({ ...f, redirect_uris: e.target.value }))} placeholder="https://app/callback,myapp://oauth/callback" /></div>}
            <div><Label>Trusted Types</Label><Input value={form.trusted_types} disabled={isServiceMode} onChange={(e) => setForm(f => ({ ...f, trusted_types: e.target.value }))} placeholder="browser,mobile,server" /></div>
            <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="crm,partner,prod" /></div>
            <div><Label>Client Secret</Label><Input value={form.client_secret} disabled={!isServiceMode && form.public} onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))} placeholder={(!isServiceMode && form.public) ? 'Public client không dùng secret' : 'Secret sẽ tự sinh nếu để trống'} /></div>
            <div className="space-y-2">
              <Label>Login Channels</Label>
              {isServiceMode ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Channel cố định: <span className="font-semibold text-slate-800">service</span></div>
              ) : (
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
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
              )}
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-5 pt-2 text-sm">
              {!isServiceMode && (
                <>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.public} onChange={(e) => setForm(f => ({ ...f, public: e.target.checked, client_secret: e.target.checked ? '' : f.client_secret }))} /> Public client</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.pkce_required} onChange={(e) => setForm(f => ({ ...f, pkce_required: e.target.checked }))} /> PKCE required</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.legacy_password_grant} onChange={(e) => setForm(f => ({ ...f, legacy_password_grant: e.target.checked }))} /> Legacy password grant</label>
                </>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} /> Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving || (!isServiceMode && form.channels.length === 0)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title={isServiceMode ? 'Service Accounts' : 'OAuth Clients'}
        subtitle={isServiceMode
          ? 'Machine-to-machine clients cho cronjob, worker, integration và internal API'
          : 'Tách client khỏi login channel để quản lý approval, audience, redirect URI, template và secret lifecycle theo từng application'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { fetchData(); fetchMetadata(); }}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={isServiceMode ? PERMISSIONS.SERVICE_CREATE : PERMISSIONS.CLIENT_CREATE}>
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
                          {client.app_type === 'internal_service' ? <Bot className="h-4 w-4 text-emerald-500" /> : <AppWindow className="h-4 w-4 text-slate-400" />}
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
