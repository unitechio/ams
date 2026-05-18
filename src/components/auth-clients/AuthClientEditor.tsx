import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Globe, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminFormNote, AdminFormSection, AdminFormSurface } from '@/components/layout/AdminFormShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { clientsApi, isStepUpRequiredError, loginChannelsApi, referenceOptionsApi, serviceAccountsApi, type LoginChannel, type ReferenceOption } from '@/lib/api';

type Mode = 'all' | 'service';

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

function buildPayload(form: typeof DEFAULT_FORM, mode: Mode) {
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

export function AuthClientEditor({ mode, clientId }: { mode: Mode; clientId?: number }) {
  const navigate = useNavigate();
  const isServiceMode = mode === 'service';
  const [channels, setChannels] = useState<LoginChannel[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOption[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(Boolean(clientId));
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);

  const clientApi = isServiceMode ? serviceAccountsApi : clientsApi;
  const backPath = isServiceMode ? '/service-accounts' : '/auth-clients';

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
  const channelOptions = channels.filter(item => item.active);

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [channelRes, optionRes] = await Promise.all([
          loginChannelsApi.list({ page: 1, page_size: 100 }),
          referenceOptionsApi.list({ page: 1, page_size: 500, active: 'true' }),
        ]);
        setChannels(channelRes.data || []);
        setReferenceOptions(optionRes.data || []);

        if (clientId) {
          const client = await clientApi.get(clientId);
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
        } else {
          const preferredTemplate = (optionRes.data || []).find((item) => item.option_group === 'client_template' && (
            isServiceMode ? parseTemplateMeta(item).app_type === 'internal_service' : parseTemplateMeta(item).app_type !== 'internal_service'
          ))?.value || (isServiceMode ? 'service_m2m' : 'spa_web');
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
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể tải form auth client');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientApi, clientId, isServiceMode]);

  useEffect(() => {
    setIsEdit(Boolean(clientId));
  }, [clientId]);

  useEffect(() => {
    if (!loading && !clientId && templateOptions.length > 0) {
      applyTemplate(form.client_template || templateOptions[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, clientId, templateOptions.length]);

  const toggleChannel = (code: string) => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels.includes(code)
        ? prev.channels.filter(item => item !== code)
        : [...prev.channels, code],
    }));
  };

  const submit = useCallback(async () => {
    const payload = buildPayload(form, mode);
    if (clientId) {
      await clientApi.update(clientId, payload);
      toast.success(isServiceMode ? 'Cập nhật service account thành công' : 'Cập nhật auth client thành công');
    } else {
      await clientApi.create(payload);
      toast.success(isServiceMode ? 'Tạo service account thành công' : 'Tạo auth client thành công');
    }
    navigate(backPath);
  }, [backPath, clientApi, clientId, form, isServiceMode, mode, navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await submit();
    } catch (err) {
      if (isStepUpRequiredError(err)) {
        setPendingAction(() => submit);
        setStepUpOpen(true);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Lưu auth client thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!pendingAction) return;
          setSaving(true);
          try {
            await pendingAction();
          } finally {
            setPendingAction(null);
            setSaving(false);
          }
        }}
        description="Xác thực lại để tạo hoặc cập nhật OAuth client / service account."
      />
      <PageHeader
        title={isEdit
          ? (isServiceMode ? 'Cập nhật Service Account' : 'Cập nhật OAuth Client')
          : (isServiceMode ? 'Tạo Service Account Mới' : 'Tạo OAuth Client Mới')}
        subtitle={isServiceMode
          ? 'Biểu mẫu machine-to-machine tách riêng khỏi client web/mobile để thao tác rõ ràng hơn.'
          : 'Biểu mẫu đầy đủ cho client application với redirect URI, channel, audience và secret lifecycle.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(`/docs?tab=security-config&section=${isServiceMode ? 'service-account' : 'oauth-client-governance'}`)}>
              Xem docs
            </Button>
            <Button variant="outline" onClick={() => navigate(backPath)}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
            <Button data-tour={!isServiceMode ? 'auth-client-save' : undefined} onClick={handleSave} disabled={saving || (!isServiceMode && form.channels.length === 0)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu
            </Button>
          </div>
        }
      />

      <AdminFormSurface className="from-white via-emerald-50/40 to-teal-50/30">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <AdminFormSection data-tour={!isServiceMode ? 'auth-client-identity' : undefined} title="Định danh Client" description="Thông tin nhận diện chính của application hoặc service đang xin token.">
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
                <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                  `App Type` cố định cho service account: `internal_service`
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
            </AdminFormSection>

            <AdminFormSection data-tour={!isServiceMode ? 'auth-client-token' : undefined} title="Token & Security" description="Điều khiển grant type, audience, redirect URI và trusted type.">
              <div><Label>Grant Types</Label><Input value={form.grant_types} disabled={isServiceMode} onChange={(e) => setForm(f => ({ ...f, grant_types: e.target.value }))} placeholder="authorization_code,refresh_token" /></div>
              <div><Label>Audiences</Label><Input value={form.audiences} onChange={(e) => setForm(f => ({ ...f, audiences: e.target.value }))} placeholder="payment-api,parking-api" /></div>
              {!isServiceMode && <div><Label>Redirect URIs</Label><Input value={form.redirect_uris} onChange={(e) => setForm(f => ({ ...f, redirect_uris: e.target.value }))} placeholder="https://app/callback,myapp://oauth/callback" /></div>}
              <div><Label>Trusted Types</Label><Input value={form.trusted_types} disabled={isServiceMode} onChange={(e) => setForm(f => ({ ...f, trusted_types: e.target.value }))} placeholder="browser,mobile,server" /></div>
              <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="crm,partner,prod" /></div>
              <div><Label>Client Secret</Label><Input value={form.client_secret} disabled={!isServiceMode && form.public} onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))} placeholder={(!isServiceMode && form.public) ? 'Public client không dùng secret' : 'Secret sẽ tự sinh nếu để trống'} /></div>
            </AdminFormSection>
          </div>

          <div className="space-y-6">
            <AdminFormSection data-tour={!isServiceMode ? 'auth-client-channels' : undefined} title="Channel Mapping" description="Kênh đăng nhập được phép dùng client này.">
              {isServiceMode ? (
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  Service account cố định channel `service`.
                </div>
              ) : (
                <div className="md:col-span-2 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
                  {channelOptions.map(channel => (
                    <label key={channel.id} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
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
            </AdminFormSection>

            <AdminFormSection data-tour={!isServiceMode ? 'auth-client-boundary' : undefined} title="Boundary" description="Public/confidential boundary và các cờ bảo mật liên quan.">
              <div className="md:col-span-2 grid grid-cols-1 gap-3 text-sm">
                {!isServiceMode && (
                  <>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <input type="checkbox" checked={form.public} onChange={(e) => setForm(f => ({ ...f, public: e.target.checked, client_secret: e.target.checked ? '' : f.client_secret }))} />
                      Public client
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <input type="checkbox" checked={form.pkce_required} onChange={(e) => setForm(f => ({ ...f, pkce_required: e.target.checked }))} />
                      PKCE required
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <input type="checkbox" checked={form.legacy_password_grant} onChange={(e) => setForm(f => ({ ...f, legacy_password_grant: e.target.checked }))} />
                      Legacy password grant
                    </label>
                  </>
                )}
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Active
                </label>
              </div>
            </AdminFormSection>

            <AdminFormNote>
              <div className="flex items-start gap-3">
                {isServiceMode ? <Bot className="mt-0.5 h-5 w-5 text-emerald-500" /> : <Globe className="mt-0.5 h-5 w-5 text-emerald-500" />}
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Tóm tắt cấu hình</p>
                  <p><span className="font-medium">Template:</span> {form.client_template}</p>
                  <p><span className="font-medium">Audience:</span> {form.audiences || 'N/A'}</p>
                  <p><span className="font-medium">Channels:</span> {isServiceMode ? 'service' : (form.channels.join(', ') || 'Chưa chọn')}</p>
                  <p><span className="font-medium">Boundary:</span> {isServiceMode ? 'Confidential / service' : (form.public ? 'Public' : 'Confidential')}</p>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    {isServiceMode
                      ? 'Service account không dùng redirect URI và luôn phát token theo client_credentials.'
                      : 'Web/mobile client nên giới hạn redirect URI, audience và chỉ bật legacy password grant khi thật sự cần.'}
                  </div>
                </div>
              </div>
            </AdminFormNote>

          </div>
        </div>
      </AdminFormSurface>
    </div>
  );
}
