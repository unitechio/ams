import React from 'react';
import { Fingerprint, Lock, ShieldAlert, ShieldCheck, ShieldEllipsis, Smartphone, Waypoints } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AuthClient, type LoginChannel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type UserSecurityForm = {
  status: string;
  one_time_password: boolean;
  require_otp: boolean;
  two_factor_enabled: boolean;
  password_expires_at: string;
  allowed_clients: string[];
  allowed_channels: string[];
};

type Props = {
  title: string;
  subtitle: string;
  form: UserSecurityForm;
  clients: AuthClient[];
  channels: LoginChannel[];
  onStatusChange: (value: string) => void;
  onToggleSwitch: (field: 'one_time_password' | 'require_otp' | 'two_factor_enabled', value: boolean) => void;
  onPasswordExpiryChange: (value: string) => void;
  onToggleMulti: (field: 'allowed_clients' | 'allowed_channels', value: string) => void;
  children?: React.ReactNode;
};

const toggleItems = [
  {
    key: 'one_time_password' as const,
    title: 'Đổi mật khẩu lần đầu',
    description: 'Buộc user đổi ngay sau lần đăng nhập đầu tiên bằng mật khẩu tạm.',
    icon: Lock,
    tone: 'emerald',
  },
  {
    key: 'require_otp' as const,
    title: 'OTP theo phiên',
    description: 'Dùng email hoặc SMS OTP cho mỗi phiên đăng nhập mới khi policy yêu cầu.',
    icon: Smartphone,
    tone: 'amber',
  },
  {
    key: 'two_factor_enabled' as const,
    title: 'TOTP / Authenticator',
    description: 'Bật cơ chế 2FA bằng app authenticator cho những tài khoản cần mức tin cậy cao hơn.',
    icon: ShieldCheck,
    tone: 'sky',
  },
] as const;

function toneClass(tone: 'emerald' | 'amber' | 'sky') {
  if (tone === 'amber') return 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300';
  if (tone === 'sky') return 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300';
  return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300';
}

export function UserAccessSecurityPanel({
  title,
  subtitle,
  form,
  clients,
  channels,
  onStatusChange,
  onToggleSwitch,
  onPasswordExpiryChange,
  onToggleMulti,
  children,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldEllipsis className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trạng thái tài khoản</Label>
              <Select value={form.status} onValueChange={onStatusChange}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="inactive">Vô hiệu</SelectItem>
                  <SelectItem value="locked">Bị khóa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hết hạn mật khẩu</Label>
              <DatePicker
                value={form.password_expires_at}
                onChange={(value) => onPasswordExpiryChange(value || '')}
                className="h-10 rounded-xl border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          <Tabs defaultValue="security">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="guide">Guide</TabsTrigger>
            </TabsList>

            <TabsContent value="security" className="space-y-4">
              <div className="grid gap-3">
                {toggleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl', toneClass(item.tone))}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                          </div>
                        </div>
                        <Switch checked={form[item.key]} onCheckedChange={(value) => onToggleSwitch(item.key, value)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-4">
              <div data-tour="create-user-clients" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-emerald-500" />
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Client được phép đăng nhập</Label>
                </div>
                <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => onToggleMulti('allowed_clients', client.client_id)}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-left transition-all',
                        form.allowed_clients.includes(client.client_id)
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                          : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/20',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{client.name || client.client_id}</div>
                          <div className="text-[11px] text-slate-400">{client.client_id} • {client.app_type}</div>
                        </div>
                        <div className={cn('h-4 w-4 rounded-full border', form.allowed_clients.includes(client.client_id) ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600')} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div data-tour="create-user-channels" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Waypoints className="h-4 w-4 text-sky-500" />
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kênh đăng nhập</Label>
                </div>
                <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => onToggleMulti('allowed_channels', channel.code)}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-left transition-all',
                        form.allowed_channels.includes(channel.code)
                          ? 'border-sky-300 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20'
                          : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900/50 dark:hover:bg-sky-950/20',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{channel.name}</div>
                          <div className="text-[11px] text-slate-400">{channel.code} • risk {channel.risk_level}</div>
                        </div>
                        <div className={cn('h-4 w-4 rounded-full border', form.allowed_channels.includes(channel.code) ? 'border-sky-500 bg-sky-500' : 'border-slate-300 dark:border-slate-600')} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="guide" className="space-y-3">
              <GuideItem title="Đổi mật khẩu lần đầu" text="Dùng khi admin cấp mật khẩu tạm. User bị giữ ở luồng đổi mật khẩu cho tới khi đổi xong." />
              <GuideItem title="OTP theo phiên" text="Phù hợp tài khoản có rủi ro trung bình, cần xác minh thêm mỗi phiên mới hoặc khi policy ép." />
              <GuideItem title="TOTP / Authenticator" text="Phù hợp tài khoản quản trị hoặc tài khoản có dữ liệu nhạy cảm, ít phụ thuộc hạ tầng gửi OTP." />
              <GuideItem title="Allowed clients / channels" text="Chỉ bật đúng app boundary và bề mặt truy cập user thực sự cần, tránh reuse token hoặc lạm quyền đăng nhập." />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {children}
    </div>
  );
}

function GuideItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}
