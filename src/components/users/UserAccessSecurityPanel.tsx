import React from 'react';
import { Fingerprint, Lock, ShieldAlert, ShieldCheck, ShieldEllipsis, Smartphone, Waypoints, Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AuthClient, type LoginChannel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
                <MultiSelectDropdown
                  options={clients.map((c) => ({
                    value: c.client_id,
                    label: c.name || c.client_id,
                    subLabel: `${c.client_id} • ${c.app_type}`,
                  }))}
                  selectedValues={form.allowed_clients}
                  onToggle={(val) => onToggleMulti('allowed_clients', val)}
                  placeholder="Tất cả client (Mặc định)"
                  searchPlaceholder="Tìm kiếm client..."
                />
              </div>

              <div data-tour="create-user-channels" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Waypoints className="h-4 w-4 text-sky-500" />
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kênh đăng nhập</Label>
                </div>
                <MultiSelectDropdown
                  options={channels.map((c) => ({
                    value: c.code,
                    label: c.name,
                    subLabel: `${c.code} • risk ${c.risk_level}`,
                  }))}
                  selectedValues={form.allowed_channels}
                  onToggle={(val) => onToggleMulti('allowed_channels', val)}
                  placeholder="Tất cả kênh (Mặc định)"
                  searchPlaceholder="Tìm kiếm kênh đăng nhập..."
                />
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

function MultiSelectDropdown({
  options,
  selectedValues,
  onToggle,
  placeholder,
  searchPlaceholder,
}: {
  options: { value: string; label: string; subLabel?: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <div className="flex flex-wrap gap-1.5 items-center">
            {selectedValues.length === 0 && <span className="text-slate-500 ml-1">{placeholder}</span>}
            {selectedValues.map((val) => {
              const opt = options.find((o) => o.value === val);
              return (
                <Badge key={val} variant="secondary" className="rounded-lg font-medium text-[11px] px-2.5 py-0.5">
                  {opt?.label || val}
                </Badge>
              );
            })}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl bg-white dark:bg-slate-950 shadow-xl border border-slate-200 dark:border-slate-800" align="start">
        <div className="flex items-center border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <input
            className="flex w-full bg-transparent text-sm outline-none placeholder:text-slate-500 h-8"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-64">
          <div className="p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Không tìm thấy kết quả.</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none transition-colors text-left mb-1 last:mb-0',
                      isSelected
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
                        : 'hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <div className="flex flex-1 flex-col">
                      <span className="font-semibold">{opt.label}</span>
                      {opt.subLabel && <span className="text-[11px] text-slate-400 mt-0.5">{opt.subLabel}</span>}
                    </div>
                    <div className={cn("ml-2 flex h-4 w-4 items-center justify-center rounded-[4px] border border-slate-300 dark:border-slate-600 transition-colors", isSelected && "bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600")}>
                      {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
