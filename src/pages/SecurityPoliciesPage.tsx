import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clientsApi, loginChannelsApi, securityPoliciesApi, type AuthClient, type LoginChannel, type PaginatedResponse, type SecurityPolicy } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

const DEFAULT_FORM = {
  code: '',
  name: '',
  description: '',
  policy_type: 'auth',
  scope_type: 'global',
  target_client: '',
  target_channel: '',
  target_action: '',
  priority: 100,
  active: true,
  config: {
    require_step_up: true,
    require_mfa: false,
    allow_password: true,
    allow_sso: true,
    trusted_device_ttl_hours: 720,
    session_ttl_minutes: 1440,
    refresh_ttl_minutes: 10080,
    step_up_ttl_minutes: 10,
    login_ip_max_attempts: 20,
    login_ip_window_minutes: 5,
    login_ip_block_minutes: 15,
    login_identity_max_attempts: 7,
    login_identity_window_minutes: 10,
    login_identity_block_minutes: 30,
    password_min_length: 8,
    require_upper: true,
    require_lower: true,
    require_number: true,
    require_special: true,
  },
};

export default function SecurityPoliciesPage() {
  const [result, setResult] = useState<PaginatedResponse<SecurityPolicy> | null>(null);
  const [clients, setClients] = useState<AuthClient[]>([]);
  const [channels, setChannels] = useState<LoginChannel[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [editing, setEditing] = useState<SecurityPolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecurityPolicy | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await securityPoliciesApi.list({ search, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải security policies');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  const fetchTargets = useCallback(async () => {
    try {
      const [clientRes, channelRes] = await Promise.all([
        clientsApi.list({ page: 1, page_size: 200 }),
        loginChannelsApi.list({ page: 1, page_size: 100 }),
      ]);
      setClients(clientRes.data || []);
      setChannels(channelRes.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải client/channel cho policy');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (policy: SecurityPolicy) => {
    setEditing(policy);
    setForm({
      code: policy.code,
      name: policy.name,
      description: policy.description,
      policy_type: policy.policy_type,
      scope_type: policy.scope_type,
      target_client: policy.target_client,
      target_channel: policy.target_channel,
      target_action: policy.target_action,
      priority: policy.priority,
      active: policy.active,
      config: {
        require_step_up: policy.config.require_step_up ?? true,
        require_mfa: policy.config.require_mfa ?? false,
        allow_password: policy.config.allow_password ?? true,
        allow_sso: policy.config.allow_sso ?? true,
        trusted_device_ttl_hours: policy.config.trusted_device_ttl_hours ?? 720,
        session_ttl_minutes: policy.config.session_ttl_minutes ?? 1440,
        refresh_ttl_minutes: policy.config.refresh_ttl_minutes ?? 10080,
        step_up_ttl_minutes: policy.config.step_up_ttl_minutes ?? 10,
        login_ip_max_attempts: policy.config.login_ip_max_attempts ?? 20,
        login_ip_window_minutes: policy.config.login_ip_window_minutes ?? 5,
        login_ip_block_minutes: policy.config.login_ip_block_minutes ?? 15,
        login_identity_max_attempts: policy.config.login_identity_max_attempts ?? 7,
        login_identity_window_minutes: policy.config.login_identity_window_minutes ?? 10,
        login_identity_block_minutes: policy.config.login_identity_block_minutes ?? 30,
        password_min_length: policy.config.password_min_length ?? 8,
        require_upper: policy.config.require_upper ?? true,
        require_lower: policy.config.require_lower ?? true,
        require_number: policy.config.require_number ?? true,
        require_special: policy.config.require_special ?? true,
      },
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        target_client: form.target_client,
        target_channel: form.target_channel,
        target_action: form.target_action,
      };
      if (editing) {
        await securityPoliciesApi.update(editing.id, payload);
        toast.success('Cập nhật security policy thành công');
      } else {
        await securityPoliciesApi.create(payload);
        toast.success('Tạo security policy thành công');
      }
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu security policy thất bại');
    } finally {
      setSaving(false);
    }
  };

  const rows = result?.data || [];
  const isAuthPolicy = form.policy_type === 'auth';
  const isStepUpPolicy = form.policy_type === 'step_up';

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!deleteTarget) return;
          await securityPoliciesApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.code}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa security policy hoặc thay đổi policy có tác động runtime."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Cập nhật security policy' : 'Tạo security policy mới'}</DialogTitle>
            <DialogDescription>Chính sách DB-backed theo `global`, `client`, `channel` hoặc `client_channel` để điều khiển MFA, login flow, session TTL và password policy.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} placeholder="global-auth-default" /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>Policy Type</Label>
              <Select value={form.policy_type} onValueChange={(value) => setForm(f => ({ ...f, policy_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="step_up">Step-up Action</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scope Type</Label>
              <Select value={form.scope_type} onValueChange={(value) => setForm(f => ({ ...f, scope_type: value, target_client: value === 'global' || value === 'channel' ? '' : f.target_client, target_channel: value === 'global' || value === 'client' ? '' : f.target_channel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="channel">Channel</SelectItem>
                  <SelectItem value="client_channel">Client + Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            {isStepUpPolicy && (
              <div className="md:col-span-2">
                <Label>Target Action</Label>
                <Select value={form.target_action || undefined} onValueChange={(value) => setForm(f => ({ ...f, target_action: value }))}>
                  <SelectTrigger><SelectValue placeholder="Chọn action nhạy cảm" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client.rotate_secret">client.rotate_secret</SelectItem>
                    <SelectItem value="policy.update">policy.update</SelectItem>
                    <SelectItem value="device.revoke">device.revoke</SelectItem>
                    <SelectItem value="user.reset_password">user.reset_password</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.scope_type === 'client' || form.scope_type === 'client_channel') && (
              <div>
                <Label>Target Client</Label>
                <Select value={form.target_client || undefined} onValueChange={(value) => setForm(f => ({ ...f, target_client: value }))}>
                  <SelectTrigger><SelectValue placeholder="Chọn client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.client_id}>{client.client_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.scope_type === 'channel' || form.scope_type === 'client_channel') && (
              <div>
                <Label>Target Channel</Label>
                <Select value={form.target_channel || undefined} onValueChange={(value) => setForm(f => ({ ...f, target_channel: value }))}>
                  <SelectTrigger><SelectValue placeholder="Chọn channel" /></SelectTrigger>
                  <SelectContent>
                    {channels.map(channel => (
                      <SelectItem key={channel.id} value={channel.code}>{channel.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: Number(e.target.value || 100) }))} /></div>
            <div className="flex items-center gap-5 pt-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} /> Active</label>
            </div>

            {isAuthPolicy ? (
              <>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.require_mfa} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_mfa: e.target.checked } }))} /> Require MFA</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.allow_password} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, allow_password: e.target.checked } }))} /> Allow password</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.allow_sso} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, allow_sso: e.target.checked } }))} /> Allow SSO</label>
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">Policy auth sẽ override runtime cho MFA, password login, SSO login, trusted device TTL và session TTL.</div>
                <div><Label>Trusted Device TTL (hours)</Label><Input type="number" value={form.config.trusted_device_ttl_hours} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, trusted_device_ttl_hours: Number(e.target.value || 0) } }))} /></div>
                <div><Label>Session TTL (minutes)</Label><Input type="number" value={form.config.session_ttl_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, session_ttl_minutes: Number(e.target.value || 0) } }))} /></div>
                <div><Label>Refresh TTL (minutes)</Label><Input type="number" value={form.config.refresh_ttl_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, refresh_ttl_minutes: Number(e.target.value || 0) } }))} /></div>
                <div><Label>Step-up TTL (minutes)</Label><Input type="number" value={form.config.step_up_ttl_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, step_up_ttl_minutes: Number(e.target.value || 0) } }))} /></div>
                <div><Label>IP Max Attempts</Label><Input type="number" value={form.config.login_ip_max_attempts} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, login_ip_max_attempts: Number(e.target.value || 0) } }))} /></div>
                <div><Label>IP Window (minutes)</Label><Input type="number" value={form.config.login_ip_window_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, login_ip_window_minutes: Number(e.target.value || 0) } }))} /></div>
                <div><Label>IP Block (minutes)</Label><Input type="number" value={form.config.login_ip_block_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, login_ip_block_minutes: Number(e.target.value || 0) } }))} /></div>
                <div><Label>Identity Max Attempts</Label><Input type="number" value={form.config.login_identity_max_attempts} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, login_identity_max_attempts: Number(e.target.value || 0) } }))} /></div>
                <div><Label>Identity Window (minutes)</Label><Input type="number" value={form.config.login_identity_window_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, login_identity_window_minutes: Number(e.target.value || 0) } }))} /></div>
                <div><Label>Identity Block (minutes)</Label><Input type="number" value={form.config.login_identity_block_minutes} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, login_identity_block_minutes: Number(e.target.value || 0) } }))} /></div>
              </>
            ) : isStepUpPolicy ? (
              <>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.require_step_up} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_step_up: e.target.checked } }))} /> Require step-up for action</label>
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500">Áp dụng theo action nhạy cảm cụ thể thay vì hard-code toàn bộ route.</div>
              </>
            ) : (
              <>
                <div><Label>Password Min Length</Label><Input type="number" value={form.config.password_min_length} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, password_min_length: Number(e.target.value || 0) } }))} /></div>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.require_upper} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_upper: e.target.checked } }))} /> Upper</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.require_lower} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_lower: e.target.checked } }))} /> Lower</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.require_number} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_number: e.target.checked } }))} /> Number</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.config.require_special} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_special: e.target.checked } }))} /> Special</label>
                </div>
              </>
            )}
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
        title="Security Policies"
        subtitle="DB-backed auth/security policy theo global, client và login channel để scale runtime governance rõ ràng hơn"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { fetchData(); fetchTargets(); }}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.POLICY_CREATE}>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo code, name, policy type, target client/channel" className="pl-9" />
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
                    <th className="px-4 py-3">Policy</th>
                    <th className="px-4 py-3">Type / Scope</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Runtime</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((policy) => (
                    <tr key={policy.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{policy.code}</div>
                        <div className="text-xs text-slate-400">{policy.name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" />{policy.policy_type}</div>
                        <div className="text-slate-400">{policy.scope_type} • p{policy.priority}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{policy.target_client || 'all clients'}</div>
                        <div className="text-slate-400">{policy.target_channel || 'all channels'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {policy.policy_type === 'auth' ? (
                          <>
                            <div>{policy.config.require_mfa ? 'Require MFA' : 'MFA inherit/default'}</div>
                            <div className="text-slate-400">Pwd: {String(policy.config.allow_password ?? true)} • SSO: {String(policy.config.allow_sso ?? true)} • Refresh: {policy.config.refresh_ttl_minutes ?? 10080}m</div>
                          </>
                        ) : policy.policy_type === 'step_up' ? (
                          <>
                            <div>Action: {policy.target_action || 'N/A'}</div>
                            <div className="text-slate-400">Require step-up: {String(policy.config.require_step_up ?? true)}</div>
                          </>
                        ) : (
                          <>
                            <div>Min length: {policy.config.password_min_length ?? 8}</div>
                            <div className="text-slate-400">U:{String(policy.config.require_upper ?? true)} L:{String(policy.config.require_lower ?? true)} N:{String(policy.config.require_number ?? true)} S:{String(policy.config.require_special ?? true)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(policy)}>
                            <ShieldAlert className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(policy); setStepUpOpen(true); }}>
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
