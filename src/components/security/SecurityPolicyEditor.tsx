import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Save, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { clientsApi, loginChannelsApi, referenceOptionsApi, securityPoliciesApi, type AuthClient, type LoginChannel, type ReferenceOption } from '@/lib/api';

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

function EditorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function SecurityPolicyEditor({ policyId }: { policyId?: number }) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<AuthClient[]>([]);
  const [channels, setChannels] = useState<LoginChannel[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOption[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [clientRes, channelRes, optionRes] = await Promise.all([
          clientsApi.list({ page: 1, page_size: 200 }),
          loginChannelsApi.list({ page: 1, page_size: 100 }),
          referenceOptionsApi.list({ page: 1, page_size: 500, active: 'true' }),
        ]);
        setClients(clientRes.data || []);
        setChannels(channelRes.data || []);
        setReferenceOptions(optionRes.data || []);

        if (policyId) {
          const policy = await securityPoliciesApi.get(policyId);
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
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể tải security policy');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [policyId]);

  const policyTypeOptions = useMemo(() => referenceOptions.filter(item => item.option_group === 'policy_type'), [referenceOptions]);
  const scopeTypeOptions = useMemo(() => referenceOptions.filter(item => item.option_group === 'policy_scope_type'), [referenceOptions]);
  const stepUpActionOptions = useMemo(() => referenceOptions.filter(item => item.option_group === 'step_up_action'), [referenceOptions]);
  const isAuthPolicy = form.policy_type === 'auth';
  const isStepUpPolicy = form.policy_type === 'step_up';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
      };
      if (policyId) {
        await securityPoliciesApi.update(policyId, payload);
        toast.success('Cập nhật security policy thành công');
      } else {
        await securityPoliciesApi.create(payload);
        toast.success('Tạo security policy thành công');
      }
      navigate('/security-policies');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lưu security policy thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={policyId ? 'Cập nhật Security Policy' : 'Tạo Security Policy Mới'}
        subtitle="Chuyển từ dialog lớn sang trang editor riêng để đủ chỗ cho các nhóm rule auth, password, rate limit và step-up."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/security-policies')}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu
            </Button>
          </div>
        }
      />

      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/35 to-emerald-50/25 p-4 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <EditorSection title="Định danh Policy" description="Thông tin identity và scope của policy.">
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} placeholder="global-auth-default" /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label>Policy Type</Label>
                <Select value={form.policy_type} onValueChange={(value) => setForm(f => ({ ...f, policy_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {policyTypeOptions.map(option => (
                      <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scope Type</Label>
                <Select value={form.scope_type} onValueChange={(value) => setForm(f => ({ ...f, scope_type: value, target_client: value === 'global' || value === 'channel' ? '' : f.target_client, target_channel: value === 'global' || value === 'client' ? '' : f.target_channel }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scopeTypeOptions.map(option => (
                      <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
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
              {isStepUpPolicy && (
                <div className="md:col-span-2">
                  <Label>Target Action</Label>
                  <Select value={form.target_action || undefined} onValueChange={(value) => setForm(f => ({ ...f, target_action: value }))}>
                    <SelectTrigger><SelectValue placeholder="Chọn action nhạy cảm" /></SelectTrigger>
                    <SelectContent>
                      {stepUpActionOptions.map(option => (
                        <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: Number(e.target.value || 100) }))} /></div>
              <div className="flex items-center gap-3 pt-6 text-sm">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Active
                </label>
              </div>
            </EditorSection>

            {isAuthPolicy ? (
              <EditorSection title="Auth & Session Runtime" description="Rule cho MFA, password login, session TTL, refresh TTL và brute-force rate limit.">
                <div className="md:col-span-2 flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.require_mfa} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_mfa: e.target.checked } }))} /> Require MFA</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.allow_password} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, allow_password: e.target.checked } }))} /> Allow password</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.allow_sso} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, allow_sso: e.target.checked } }))} /> Allow SSO</label>
                </div>
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
              </EditorSection>
            ) : isStepUpPolicy ? (
              <EditorSection title="Step-up Action Rule" description="Bật/tắt step-up cho action nhạy cảm đã chọn.">
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                    <input type="checkbox" checked={form.config.require_step_up} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_step_up: e.target.checked } }))} />
                    Require step-up for action
                  </label>
                </div>
              </EditorSection>
            ) : (
              <EditorSection title="Password Policy" description="Yêu cầu độ phức tạp và độ dài mật khẩu cho user lifecycle.">
                <div><Label>Password Min Length</Label><Input type="number" value={form.config.password_min_length} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, password_min_length: Number(e.target.value || 0) } }))} /></div>
                <div className="md:col-span-2 flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.require_upper} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_upper: e.target.checked } }))} /> Upper</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.require_lower} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_lower: e.target.checked } }))} /> Lower</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.require_number} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_number: e.target.checked } }))} /> Number</label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.config.require_special} onChange={(e) => setForm(f => ({ ...f, config: { ...f.config, require_special: e.target.checked } }))} /> Special</label>
                </div>
              </EditorSection>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-emerald-500" />
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Preview runtime</p>
                  <p><span className="font-medium">Type:</span> {form.policy_type}</p>
                  <p><span className="font-medium">Scope:</span> {form.scope_type}</p>
                  <p><span className="font-medium">Client:</span> {form.target_client || 'all clients'}</p>
                  <p><span className="font-medium">Channel:</span> {form.target_channel || 'all channels'}</p>
                  {isStepUpPolicy ? <p><span className="font-medium">Action:</span> {form.target_action || 'N/A'}</p> : null}
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    Policy editor mới hiển thị đầy đủ toàn bộ field, không còn thiếu field ở màn cập nhật như dialog cũ.
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
