import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Save, ShieldCheck, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { AdminFormNote, AdminFormSection, AdminFormSurface } from '@/components/layout/AdminFormShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isStepUpRequiredError, loginChannelsApi, referenceOptionsApi, type ReferenceOption } from '@/lib/api';

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

export function LoginChannelEditor({ channelId }: { channelId?: number }) {
  const navigate = useNavigate();
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOption[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const optionRes = await referenceOptionsApi.list({ option_group: 'channel_risk_level', active: 'true', page: 1, page_size: 100 });
        setReferenceOptions(optionRes.data || []);
        if (!channelId) return;
        const channel = await loginChannelsApi.get(channelId);
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể tải login channel');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [channelId]);

  const riskLevelOptions = useMemo(() => referenceOptions.filter(item => item.option_group === 'channel_risk_level'), [referenceOptions]);

  const submit = async () => {
    if (channelId) {
      await loginChannelsApi.update(channelId, form);
      toast.success('Cập nhật login channel thành công');
    } else {
      await loginChannelsApi.create(form);
      toast.success('Tạo login channel thành công');
    }
    navigate('/login-channels');
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
      toast.error(err instanceof Error ? err.message : 'Lưu login channel thất bại');
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
        description="Xác thực lại để tạo hoặc cập nhật login channel."
      />
      <PageHeader
        title={channelId ? 'Cập nhật Login Channel' : 'Tạo Login Channel Mới'}
        subtitle="Editor riêng cho policy theo bề mặt đăng nhập: MFA, risk level, session TTL và trusted-device."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/docs?tab=security-config&section=login-channel-runtime')}>
              Xem docs
            </Button>
            <Button variant="outline" onClick={() => navigate('/login-channels')}><ArrowLeft className="mr-2 h-4 w-4" />Quay lại</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu
            </Button>
          </div>
        }
      />

      <AdminFormSurface className="from-white via-emerald-50/40 to-sky-50/30">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <AdminFormSection title="Định danh Channel" description="Một channel đại diện cho bề mặt đăng nhập như web, mobile, kiosk, partner.">
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
              <div className="flex items-center gap-3 pt-6 text-sm">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Active
                </label>
              </div>
            </AdminFormSection>

            <AdminFormSection title="Auth Runtime" description="Điều khiển phương thức đăng nhập được phép và các TTL áp theo channel.">
              <div><Label>Trusted Device TTL (hours)</Label><Input type="number" value={form.trusted_device_ttl_hours} onChange={(e) => setForm(f => ({ ...f, trusted_device_ttl_hours: Number(e.target.value) || 0 }))} /></div>
              <div><Label>Session TTL (minutes)</Label><Input type="number" value={form.session_ttl_minutes} onChange={(e) => setForm(f => ({ ...f, session_ttl_minutes: Number(e.target.value) || 0 }))} /></div>
              <div className="md:col-span-2 flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.require_mfa} onChange={(e) => setForm(f => ({ ...f, require_mfa: e.target.checked }))} /> Require MFA</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.allow_password} onChange={(e) => setForm(f => ({ ...f, allow_password: e.target.checked }))} /> Allow password</label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"><input type="checkbox" checked={form.allow_sso} onChange={(e) => setForm(f => ({ ...f, allow_sso: e.target.checked }))} /> Allow SSO</label>
              </div>
            </AdminFormSection>
          </div>

          <div className="space-y-6">
            <AdminFormNote>
              <div className="flex items-start gap-3">
                <Workflow className="mt-0.5 h-5 w-5 text-emerald-500" />
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Preview runtime</p>
                  <p><span className="font-medium">Channel:</span> {form.code || 'N/A'}</p>
                  <p><span className="font-medium">Risk:</span> {form.risk_level}</p>
                  <p><span className="font-medium">Access:</span> {form.allow_password ? 'Password' : 'No password'} {form.allow_sso ? '• SSO' : ''}</p>
                  <p><span className="font-medium">MFA:</span> {form.require_mfa ? 'Required' : 'Optional'}</p>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    Login channel editor mới thay dialog lớn cũ để thao tác dễ hơn trên desktop và mobile.
                  </div>
                </div>
              </div>
            </AdminFormNote>

            <AdminFormNote>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-sky-500" />
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Security notes</p>
                  <p>Không encode channel vào `client_id`; channel nên đại diện UX/risk boundary.</p>
                  <p>Policy MFA/TTL có thể override tiếp bằng security policy theo `client_channel` nếu cần.</p>
                </div>
              </div>
            </AdminFormNote>

          </div>
        </div>
      </AdminFormSurface>
    </div>
  );
}
