import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Save,
  Mail,
  User as UserIcon,
  Phone,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clientsApi,
  loginChannelsApi,
  usersApi,
  rolesApi,
  type ApiRole,
  type AuthClient,
  type LoginChannel,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateRandomPassword, getPasswordPolicyHint } from "@/lib/password";
import { UserAccessSecurityPanel } from "@/components/users/UserAccessSecurityPanel";

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [clients, setClients] = useState<AuthClient[]>([]);
  const [channels, setChannels] = useState<LoginChannel[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    phone: "",
    status: "active",
    role_ids: [] as number[],
    one_time_password: false,
    require_otp: false,
    two_factor_enabled: false,
    password_expires_at: "",
    allowed_clients: ["web_portal"] as string[],
    allowed_channels: ["web"] as string[],
  });

  useEffect(() => {
    Promise.all([
      rolesApi.list({ page_size: 100 }),
      clientsApi.list({ page: 1, page_size: 200 }),
      loginChannelsApi.list({ active: "true", page: 1, page_size: 100 }),
    ])
      .then(([rolesRes, clientsRes, channelsRes]) => {
        const activeClients = (clientsRes.data || []).filter(
          (client) => client.active,
        );
        const activeChannels = (channelsRes.data || []).filter(
          (channel) => channel.active,
        );
        setRoles(rolesRes.data);
        setClients(activeClients);
        setChannels(activeChannels);
        setForm((prev) => ({
          ...prev,
          allowed_clients:
            prev.allowed_clients.length > 0
              ? prev.allowed_clients
              : activeClients.slice(0, 1).map((client) => client.client_id),
          allowed_channels:
            prev.allowed_channels.length > 0
              ? prev.allowed_channels
              : activeChannels.slice(0, 1).map((channel) => channel.code),
        }));
      })
      .catch(() => toast.error("Lỗi tải danh sách vai trò"))
      .finally(() => setLoadingRoles(false));
  }, []);

  const handleSave = async () => {
    if (!form.username || !form.password || !form.full_name || !form.email) {
      toast.warning("Vui lòng điền đầy đủ các thông tin bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await usersApi.create({
        ...form,
        password_expires_at: form.password_expires_at
          ? new Date(form.password_expires_at).toISOString()
          : undefined,
      });
      toast.success("Tạo người dùng mới thành công");
      navigate("/users");
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi tạo người dùng");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (id: number) =>
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(id)
        ? f.role_ids.filter((r) => r !== id)
        : [...f.role_ids, id],
    }));

  const toggleMulti = (
    field: "allowed_clients" | "allowed_channels",
    value: string,
  ) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((item) => item !== value)
        : [...f[field], value],
    }));

  const applyRandomPassword = () => {
    const password = generateRandomPassword();
    setForm((f) => ({ ...f, password, one_time_password: true }));
    navigator.clipboard.writeText(password).catch(() => {});
    toast.success("Đã tạo và sao chép mật khẩu ngẫu nhiên");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Tạo người dùng mới"
        subtitle="Khởi tạo tài khoản nhân viên với đầy đủ cấu hình bảo mật và vai trò"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/users")}
            className="h-9 rounded-lg border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Quay lại
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div
            data-tour="create-user-basic"
            className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/30 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Thông tin cơ bản
              </h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tên đăng nhập <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="username"
                    value={form.username}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    className="rounded-lg h-10 border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Mật khẩu <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                      className="pl-9 pr-10 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">
                      {getPasswordPolicyHint()}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyRandomPassword}
                      className="h-8 rounded-lg whitespace-nowrap"
                    >
                      Random pass
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Họ và tên <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Nguyễn Văn A"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                    className="rounded-lg h-10 border-slate-200 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="email@domain.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      className="pl-9 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Số điện thoại
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="0912345678"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="pl-9 h-10 rounded-lg border-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Roles Selection Card */}
          <div
            data-tour="create-user-roles"
            className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-50 bg-slate-50/30 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Gán vai trò hệ thống
              </h3>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {loadingRoles ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-4 w-full justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh
                    sách vai trò...
                  </div>
                ) : (
                  roles.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer group",
                        form.role_ids.includes(r.id)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold"
                          : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={form.role_ids.includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                        className="hidden"
                      />
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                          form.role_ids.includes(r.id)
                            ? "bg-emerald-500 border-emerald-500"
                            : "bg-white border-slate-300 group-hover:border-emerald-500",
                        )}
                      >
                        {form.role_ids.includes(r.id) && (
                          <UserCheck className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-[13px]">{r.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Config Column */}
        <div className="space-y-6">
          <UserAccessSecurityPanel
            title="Chính sách bảo mật"
            subtitle="Gom các rule auth và access boundary thành panel tabs để thao tác nhanh hơn, đỡ scroll dọc."
            form={form}
            clients={clients}
            channels={channels}
            onStatusChange={(value) =>
              setForm((prev) => ({ ...prev, status: value }))
            }
            onToggleSwitch={(field, value) =>
              setForm((prev) => ({ ...prev, [field]: value }))
            }
            onPasswordExpiryChange={(value) =>
              setForm((prev) => ({ ...prev, password_expires_at: value }))
            }
            onToggleMulti={toggleMulti}
          >
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500" />
                <p className="text-[11px] italic leading-relaxed text-amber-700 dark:text-amber-300">
                  Tài khoản sau khi tạo sẽ nhận được mật khẩu mặc định. Hãy đảm
                  bảo gửi thông tin đăng nhập cho người dùng qua kênh an toàn.
                </p>
              </div>
            </div>
          </UserAccessSecurityPanel>

          <Button
            data-tour="create-user-save"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-100 font-bold rounded-lg transition-all active:scale-95"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Lưu & Khởi tạo
          </Button>
        </div>
      </div>
    </div>
  );
}
