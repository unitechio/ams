import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ArrowLeft, Loader2, ShieldCheck, Save,
  Mail, User as UserIcon, Phone, Lock, Calendar,
  UserCheck, ShieldAlert
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usersApi, rolesApi, type ApiRole } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    username: '', password: '', full_name: '', email: '',
    phone: '', status: 'active', role_ids: [] as number[],
    one_time_password: false, require_otp: false, two_factor_enabled: false,
    password_expires_at: ''
  });

  useEffect(() => {
    rolesApi.list({ page_size: 100 })
      .then(res => setRoles(res.data))
      .catch(() => toast.error('Lỗi tải danh sách vai trò'))
      .finally(() => setLoadingRoles(false));
  }, []);

  const handleSave = async () => {
    if (!form.username || !form.password || !form.full_name || !form.email) {
      toast.warning('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }
    setSaving(true);
    try {
      await usersApi.create({
        ...form,
        password_expires_at: form.password_expires_at ? new Date(form.password_expires_at).toISOString() : undefined
      });
      toast.success('Tạo người dùng mới thành công');
      navigate('/users');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi tạo người dùng');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (id: number) =>
    setForm(f => ({ ...f, role_ids: f.role_ids.includes(id) ? f.role_ids.filter(r => r !== id) : [...f.role_ids, id] }));

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Tạo người dùng mới"
        subtitle="Khởi tạo tài khoản nhân viên với đầy đủ cấu hình bảo mật và vai trò"
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
              <h3 className="text-sm font-bold text-slate-800">Thông tin cơ bản</h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tên đăng nhập <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="username"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="rounded-lg h-10 border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mật khẩu <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="pl-9 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Họ và tên <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Nguyễn Văn A"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="rounded-lg h-10 border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email <span className="text-red-500">*</span></Label>
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
              <h3 className="text-sm font-bold text-slate-800">Gán vai trò hệ thống</h3>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {loadingRoles ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-4 w-full justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách vai trò...
                  </div>
                ) : roles.map(r => (
                  <label
                    key={r.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer group",
                      form.role_ids.includes(r.id)
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold"
                        : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50"
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
              <h3 className="text-sm font-bold text-slate-800">Chính sách bảo mật</h3>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Trạng thái khởi tạo</Label>
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
                {/* One-time password — core feature, always enabled */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[13px] font-semibold text-slate-800">Đổi MK lần đầu</Label>
                    <p className="text-[11px] text-slate-400">
                      User phải đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
                    </p>
                  </div>
                  <Switch
                    checked={form.one_time_password}
                    onCheckedChange={v => setForm(f => ({ ...f, one_time_password: v }))}
                  />
                </div>

                {/* Separator + backend-required note */}
                <div className="pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      Yêu cầu cấu hình BE
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <div className="space-y-4 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-[13px] font-semibold text-slate-700">Xác thực OTP</Label>
                        <p className="text-[11px] text-slate-400">
                          Gửi mã OTP qua email/SMS mỗi phiên (cần cấu hình provider).
                        </p>
                      </div>
                      <Switch
                        checked={form.require_otp}
                        onCheckedChange={v => setForm(f => ({ ...f, require_otp: v }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-[13px] font-semibold text-slate-700">Bật 2FA (TOTP)</Label>
                        <p className="text-[11px] text-slate-400">
                          Dùng ứng dụng Authenticator. User cần tự setup 2FA sau khi đăng nhập.
                        </p>
                      </div>
                      <Switch
                        checked={form.two_factor_enabled}
                        onCheckedChange={v => setForm(f => ({ ...f, two_factor_enabled: v }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hết hạn mật khẩu</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <DatePicker
                    value={form.password_expires_at}
                    onChange={v => setForm(f => ({ ...f, password_expires_at: v || '' }))}
                    className="pl-9 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                  />
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
            Lưu & Khởi tạo
          </Button>

          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed italic">
              Tài khoản sau khi tạo sẽ nhận được mật khẩu mặc định. Hãy đảm bảo gửi thông tin đăng nhập cho người dùng qua kênh an toàn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
