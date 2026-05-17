import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Pencil, ArrowLeft, Loader2, ShieldCheck, Save,
  Mail, User as UserIcon, Phone, Lock, Calendar, RefreshCcw,
  UserCheck, ShieldAlert
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usersApi, rolesApi, type ApiRole, type ApiUser } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

const CLIENT_OPTIONS = [
  { value: 'web_portal', label: 'Web Portal' },
  { value: 'crm_portal', label: 'CRM Portal' },
  { value: 'mobile_app_tpv_public', label: 'Mobile App' },
];

const CHANNEL_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'crm', label: 'CRM' },
  { value: 'mobile', label: 'Mobile' },
];

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<ApiUser | null>(null);

  const [form, setForm] = useState({
    full_name: '', email: '',
    phone: '', status: 'active', role_ids: [] as number[],
    one_time_password: false, require_otp: false, two_factor_enabled: false,
    password_expires_at: '',
    allowed_clients: ['web_portal'] as string[],
    allowed_channels: ['web'] as string[],
  });

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    // Note: Ideally we'd have a GetByID endpoint, but we'll use list for now
    Promise.all([
      usersApi.list({ search: '', page: 1, page_size: 1000 }),
      rolesApi.list({ page_size: 100 })
    ])
      .then(([usersRes, rolesRes]) => {
        const found = usersRes.data.find(u => u.id === parseInt(id));
        if (!found) {
          toast.error('Không tìm thấy người dùng');
          navigate('/users');
          return;
        }
        setUser(found);
        setRoles(rolesRes.data);
        setForm({
          full_name: found.full_name,
          email: found.email,
          phone: found.phone || '',
          status: found.status,
          role_ids: found.role_ids || [],
          one_time_password: found.one_time_password || false,
          require_otp: found.require_otp || false,
          two_factor_enabled: found.two_factor_enabled || false,
          password_expires_at: found.password_expires_at?.split('T')[0] || '',
          allowed_clients: found.allowed_clients || ['web_portal'],
          allowed_channels: found.allowed_channels || ['web'],
        });
      })
      .catch(() => toast.error('Lỗi tải dữ liệu'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSave = async () => {
    if (!id) return;
    if (!form.full_name || !form.email) {
      toast.warning('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }
    setSaving(true);
    try {
      await usersApi.update(parseInt(id), {
        ...form,
        password_expires_at: form.password_expires_at ? new Date(form.password_expires_at).toISOString() : undefined
      });
      toast.success('Cập nhật người dùng thành công');
      navigate('/users');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi cập nhật người dùng');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleID: number) =>
    setForm(f => ({ ...f, role_ids: f.role_ids.includes(roleID) ? f.role_ids.filter(r => r !== roleID) : [...f.role_ids, roleID] }));

  const toggleMulti = (field: 'allowed_clients' | 'allowed_channels', value: string) =>
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(item => item !== value) : [...f[field], value],
    }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium animate-pulse">Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Chỉnh sửa người dùng"
        subtitle={`Cập nhật thông tin và cấu hình bảo mật cho tài khoản @${user?.username}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/users')} className="h-9 rounded-lg border-slate-200">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Quay lại
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Basic Info Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <UserIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Thông tin hồ sơ</h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tên đăng nhập</Label>
                  <Input value={user?.username} disabled className="bg-slate-50 border-slate-100 font-mono text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Họ và tên <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Nguyễn Văn A"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="rounded-lg h-10 border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email liên hệ <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="email@domain.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="pl-9 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Số điện thoại</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="0912345678"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="pl-9 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Roles Selection Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Phân quyền vai trò</h3>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {roles.map(r => (
                  <label
                    key={r.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer group",
                      form.role_ids.includes(r.id)
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold"
                        : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.role_ids.includes(r.id)}
                      onChange={() => toggleRole(r.id)}
                      className="hidden"
                    />
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                      form.role_ids.includes(r.id) ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300 group-hover:border-emerald-500"
                    )}>
                      {form.role_ids.includes(r.id) && <UserCheck className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-[13px]">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Config Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Chế độ bảo mật</h3>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Trạng thái tài khoản</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-10 rounded-lg border-slate-200 focus:ring-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Hoạt động</SelectItem>
                    <SelectItem value="inactive">Vô hiệu</SelectItem>
                    <SelectItem value="locked">Bị khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] font-semibold text-slate-800">Đổi MK lần đầu</Label>
                    <p className="text-[11px] text-slate-400">Yêu cầu sau khi đăng nhập</p>
                  </div>
                  <Switch
                    checked={form.one_time_password}
                    onCheckedChange={v => setForm(f => ({ ...f, one_time_password: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] font-semibold text-slate-800">Xác thực OTP</Label>
                    <p className="text-[11px] text-slate-400">Mỗi phiên đăng nhập mới</p>
                  </div>
                  <Switch
                    checked={form.require_otp}
                    onCheckedChange={v => setForm(f => ({ ...f, require_otp: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] font-semibold text-slate-800">Bật 2FA (TOTP)</Label>
                    <p className="text-[11px] text-slate-400">Dùng Google Authenticator</p>
                  </div>
                  <Switch
                    checked={form.two_factor_enabled}
                    onCheckedChange={v => setForm(f => ({ ...f, two_factor_enabled: v }))}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hết hạn mật khẩu</Label>
                <DatePicker
                  value={form.password_expires_at}
                  onChange={v => setForm(f => ({ ...f, password_expires_at: v || '' }))}
                  className="h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-3">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Client được phép đăng nhập</Label>
                <div className="space-y-2">
                  {CLIENT_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.allowed_clients.includes(option.value)}
                        onChange={() => toggleMulti('allowed_clients', option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-3">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kênh đăng nhập</Label>
                <div className="space-y-2">
                  {CHANNEL_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.allowed_channels.includes(option.value)}
                        onChange={() => toggleMulti('allowed_channels', option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-100 font-bold rounded-lg transition-all active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Lưu thay đổi
          </Button>

          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed italic">
              Lưu ý: Mọi thay đổi về trạng thái hoặc quyền hạn sẽ có hiệu lực ngay lập tức. Người dùng có thể bị đăng xuất nếu trạng thái bị thay đổi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
