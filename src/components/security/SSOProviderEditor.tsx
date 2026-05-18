import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminFormSection, AdminFormSurface } from '@/components/layout/AdminFormShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isStepUpRequiredError, ssoProvidersAdminApi } from '@/lib/api';

const DEFAULT_FORM = {
  provider_id: '',
  name: '',
  type: 'oidc',
  client_id: '',
  client_secret: '',
  authorize_url: '',
  token_url: '',
  user_info_url: '',
  redirect_uri: '',
  scope: 'openid profile email',
  saml_login_url: '',
  enabled: false,
  allow_auto_provision: true,
  icon: 'Shield',
};

export function SSOProviderEditor({ providerId }: { providerId?: number }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (!providerId) return;
        const provider = await ssoProvidersAdminApi.get(providerId);
        setForm({
          provider_id: provider.provider_id,
          name: provider.name,
          type: provider.type,
          client_id: provider.client_id,
          client_secret: provider.client_secret,
          authorize_url: provider.authorize_url,
          token_url: provider.token_url,
          user_info_url: provider.user_info_url,
          redirect_uri: provider.redirect_uri,
          scope: provider.scope,
          saml_login_url: provider.saml_login_url,
          enabled: provider.enabled,
          allow_auto_provision: provider.allow_auto_provision,
          icon: provider.icon || 'Shield',
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể tải SSO provider');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [providerId]);

  const submit = async () => {
    if (providerId) {
      await ssoProvidersAdminApi.update(providerId, form);
      toast.success('Cập nhật SSO provider thành công');
    } else {
      await ssoProvidersAdminApi.create(form);
      toast.success('Tạo SSO provider thành công');
    }
    navigate('/sso-providers');
  };

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
      toast.error(err instanceof Error ? err.message : 'Lưu SSO provider thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  const isOIDC = form.type !== 'saml';

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
        description="Xác thực lại để tạo hoặc cập nhật SSO provider."
      />
      <PageHeader
        title={providerId ? 'Cập nhật SSO Provider' : 'Tạo SSO Provider Mới'}
        subtitle="Editor riêng cho OIDC/OAuth2/SAML để đủ chỗ cho callback, endpoint và provisioning rule."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/docs?tab=security-config&section=sso-provider-registry')}>
              Xem docs
            </Button>
            <Button variant="outline" onClick={() => navigate('/sso-providers')}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu
            </Button>
          </div>
        }
      />

      <AdminFormSurface className="from-white via-sky-50/40 to-emerald-50/30">
        <div className="space-y-6">
          <AdminFormSection title="Định danh Provider">
            <div><Label>Provider ID</Label><Input value={form.provider_id} onChange={(e) => setForm(f => ({ ...f, provider_id: e.target.value }))} /></div>
            <div><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(value) => setForm(f => ({ ...f, type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oidc">OIDC</SelectItem>
                  <SelectItem value="oauth2">OAuth2</SelectItem>
                  <SelectItem value="saml">SAML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Icon</Label><Input value={form.icon} onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))} /></div>
          </AdminFormSection>

          <AdminFormSection title="Identity Provider Configuration">
            <div><Label>Client ID</Label><Input value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} /></div>
            <div><Label>Client Secret</Label><Input value={form.client_secret} onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))} /></div>
            {isOIDC ? (
              <>
                <div><Label>Authorize URL</Label><Input value={form.authorize_url} onChange={(e) => setForm(f => ({ ...f, authorize_url: e.target.value }))} /></div>
                <div><Label>Token URL</Label><Input value={form.token_url} onChange={(e) => setForm(f => ({ ...f, token_url: e.target.value }))} /></div>
                <div><Label>User Info URL</Label><Input value={form.user_info_url} onChange={(e) => setForm(f => ({ ...f, user_info_url: e.target.value }))} /></div>
                <div><Label>Scope</Label><Input value={form.scope} onChange={(e) => setForm(f => ({ ...f, scope: e.target.value }))} /></div>
              </>
            ) : (
              <div className="md:col-span-2"><Label>SAML Login URL</Label><Input value={form.saml_login_url} onChange={(e) => setForm(f => ({ ...f, saml_login_url: e.target.value }))} /></div>
            )}
            <div className="md:col-span-2"><Label>Redirect URI</Label><Input value={form.redirect_uri} onChange={(e) => setForm(f => ({ ...f, redirect_uri: e.target.value }))} /></div>
            <div className="md:col-span-2 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm(f => ({ ...f, enabled: e.target.checked }))} /> Enabled</label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.allow_auto_provision} onChange={(e) => setForm(f => ({ ...f, allow_auto_provision: e.target.checked }))} /> Auto provision user</label>
            </div>
          </AdminFormSection>
        </div>
      </AdminFormSurface>
    </div>
  );
}
