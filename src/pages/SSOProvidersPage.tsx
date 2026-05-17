import React, { useCallback, useEffect, useState } from 'react';
import { Globe2, Loader2, Plus, RefreshCcw, Search, Shield, Trash2, Waypoints } from 'lucide-react';
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
import { ssoProvidersAdminApi, type AdminSSOProvider, type PaginatedResponse } from '@/lib/api';
import { toast } from 'sonner';

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

export default function SSOProvidersPage() {
  const [result, setResult] = useState<PaginatedResponse<AdminSSOProvider> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSSOProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminSSOProvider | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ssoProvidersAdminApi.list({ search, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách SSO provider');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (provider: AdminSSOProvider) => {
    setEditing(provider);
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await ssoProvidersAdminApi.update(editing.id, form);
        toast.success('Cập nhật SSO provider thành công');
      } else {
        await ssoProvidersAdminApi.create(form);
        toast.success('Tạo SSO provider thành công');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu SSO provider thất bại');
    } finally {
      setSaving(false);
    }
  };

  const rows = result?.data || [];
  const isOIDC = form.type !== 'saml';

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!deleteTarget) return;
          await ssoProvidersAdminApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.provider_id}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa SSO provider hoặc thay đổi cấu hình nhạy cảm."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật SSO provider' : 'Tạo SSO provider mới'}</DialogTitle>
            <DialogDescription>Quản lý metadata cho OIDC/OAuth2/SAML, callback URL, userinfo endpoint, auto-provision và trạng thái kích hoạt.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Provider ID</Label><Input value={form.provider_id} onChange={(e) => setForm(f => ({ ...f, provider_id: e.target.value }))} placeholder="google-workspace" /></div>
            <div><Label>Tên hiển thị</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Google Workspace" /></div>
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
            <div><Label>Icon</Label><Input value={form.icon} onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="Shield / Chrome / Building2" /></div>
            <div><Label>Client ID</Label><Input value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))} placeholder="client-id-from-idp" /></div>
            <div><Label>Client Secret</Label><Input value={form.client_secret} onChange={(e) => setForm(f => ({ ...f, client_secret: e.target.value }))} placeholder="client-secret-from-idp" /></div>
            {isOIDC ? (
              <>
                <div><Label>Authorize URL</Label><Input value={form.authorize_url} onChange={(e) => setForm(f => ({ ...f, authorize_url: e.target.value }))} placeholder="https://idp/authorize" /></div>
                <div><Label>Token URL</Label><Input value={form.token_url} onChange={(e) => setForm(f => ({ ...f, token_url: e.target.value }))} placeholder="https://idp/token" /></div>
                <div><Label>User Info URL</Label><Input value={form.user_info_url} onChange={(e) => setForm(f => ({ ...f, user_info_url: e.target.value }))} placeholder="https://idp/userinfo" /></div>
                <div><Label>Scope</Label><Input value={form.scope} onChange={(e) => setForm(f => ({ ...f, scope: e.target.value }))} placeholder="openid profile email" /></div>
              </>
            ) : (
              <div className="md:col-span-2"><Label>SAML Login URL</Label><Input value={form.saml_login_url} onChange={(e) => setForm(f => ({ ...f, saml_login_url: e.target.value }))} placeholder="https://idp.company.com/saml/login" /></div>
            )}
            <div className="md:col-span-2"><Label>Redirect URI / Callback URL</Label><Input value={form.redirect_uri} onChange={(e) => setForm(f => ({ ...f, redirect_uri: e.target.value }))} placeholder="https://app.company.com/sso/callback/google" /></div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-5 pt-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm(f => ({ ...f, enabled: e.target.checked }))} /> Enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_auto_provision} onChange={(e) => setForm(f => ({ ...f, allow_auto_provision: e.target.checked }))} /> Auto provision user</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="SSO Providers"
        subtitle="Quản lý cấu hình OIDC/OAuth2/SAML trong database thay vì phụ thuộc hoàn toàn vào env"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.CLIENT_CREATE}>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo provider_id, name, type" className="pl-9" />
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
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Client / Scope</th>
                    <th className="px-4 py-3">Callback</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((provider) => (
                    <tr key={provider.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{provider.provider_id}</div>
                        <div className="text-xs text-slate-400">{provider.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {provider.type === 'saml' ? <Waypoints className="h-4 w-4 text-violet-500" /> : <Globe2 className="h-4 w-4 text-emerald-500" />}
                          <span>{provider.type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-700">{provider.client_id || 'N/A'}</div>
                        <div className="text-xs text-slate-400">{provider.scope || 'No scope'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{provider.redirect_uri || provider.saml_login_url || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className={provider.enabled ? 'text-emerald-600' : 'text-slate-400'}>{provider.enabled ? 'Enabled' : 'Disabled'}</span>
                          <span className={provider.allow_auto_provision ? 'text-blue-600' : 'text-slate-400'}>{provider.allow_auto_provision ? 'Auto provision' : 'Manual link'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(provider)}>
                            <Shield className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(provider); setStepUpOpen(true); }}>
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
