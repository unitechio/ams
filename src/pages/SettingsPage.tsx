import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, Save, Loader2, CheckCircle, AlertCircle, Shield, Smartphone, Laptop, Globe, LogOut, Trash2, Key, Activity } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PERMISSION_LABELS } from '@/auth/permissions';
import { usePermission } from '@/auth/usePermission';
import { PageHeader } from '@/components/layout/PageHeader';
import { StepUpDialog } from '@/components/auth/StepUpDialog';

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  show: boolean;
  toggle: () => void;
  placeholder?: string;
}

const PasswordInput = ({ label, value, onChange, show, toggle, placeholder }: PasswordInputProps) => (
  <div className="space-y-1.5">
    <Label className="dark:text-slate-400">{label}</Label>
    <div className="relative">
      <Lock className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
      <Input
        type={show ? 'text' : 'password'}
        placeholder={placeholder || '••••••••'}
        className="pl-8 pr-9 dark:bg-slate-950 dark:border-slate-800"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <button type="button" onClick={toggle}
        className="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

export default function SettingsPage() {

  const { user } = useAuth();
  const { isSuperAdmin } = usePermission();

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState({ old: false, new_: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState(false);

  // 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.two_factor_enabled || false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState<{ secret: string; qr_code_url: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<null | (() => Promise<void>)>(null);

  React.useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await authApi.sessions();
      setSessions(data || []);
    } catch (e: any) {
      console.error("Failed to fetch sessions", e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    setStepUpAction(() => async () => {
      try {
        await authApi.revokeSession(id);
        setSessions(s => s.filter(x => x.id !== id));
      } catch (e: any) {
        console.error("Failed to revoke session", e);
      }
    });
    setStepUpOpen(true);
  };

  const handleRevokeAll = async () => {
    setStepUpAction(() => async () => {
      try {
        await authApi.revokeAllSessions();
        setSessions(s => s.filter(x => x.is_current));
      } catch (e: any) {
        console.error("Failed to revoke all sessions", e);
      }
    });
    setStepUpOpen(true);
  };

  const handleToggle2FA = async () => {
    if (is2FAEnabled) {
      setStepUpAction(() => async () => {
        try {
          await authApi.disable2FA();
          setIs2FAEnabled(false);
        } catch (e: any) {
          console.error("Failed to disable 2FA", e);
        }
      });
      setStepUpOpen(true);
    } else {
      try {
        const data = await authApi.setup2FA();
        setSetup2FAData(data);
        setShow2FASetup(true);
      } catch (e: any) {
        console.error("Failed to setup 2FA", e);
      }
    }
  };

  const handleVerify2FA = async () => {
    if (!otpCode) return;
    setVerifying2FA(true);
    try {
      await authApi.verify2FA(otpCode);
      setIs2FAEnabled(true);
      setShow2FASetup(false);
    } catch (e: any) {
      console.error("Failed to verify 2FA", e);
    } finally {
      setVerifying2FA(false);
      setOtpCode('');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwOk(false);
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Mật khẩu xác nhận không khớp'); return; }
    if (pwForm.new_password.length < 6) { setPwError('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(pwForm.old_password, pwForm.new_password);
      setPwOk(true);
      setPwForm({ old_password: '', new_password: '', confirm: '' });
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Đổi mật khẩu thất bại');
    } finally { setSaving(false); }
  };

  // Note: PasswordInput has been moved outside the component to prevent focus loss issues.


  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (stepUpAction) await stepUpAction();
          setStepUpAction(null);
        }}
        description="Xác thực lại để thu hồi phiên hoặc thay đổi cấu hình 2FA."
      />
      <PageHeader
        title="Cài đặt tài khoản"
        subtitle="Quản lý thông tin cá nhân và bảo mật" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Account Info */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Thông tin tài khoản
              </p>

              <p className="text-xs text-slate-400 dark:text-slate-500">
                Quản lý thông tin cá nhân và trạng thái tài khoản
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Avatar + Basic */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg shadow-emerald-500/20">
                {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>

              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-slate-100 break-words">
                  {user?.full_name}
                </p>

                <p className="text-sm text-slate-400 dark:text-slate-500 break-all">
                  @{user?.username}
                </p>

                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user?.roles?.map(r => (
                    <span
                      key={r}
                      className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-medium border border-emerald-100 dark:border-emerald-800/50"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-1">
              {[
                { label: 'Email', value: user?.email },
                { label: 'Email verified', value: user?.email_verified ? 'Đã xác minh' : 'Chưa xác minh' },
                { label: 'Trạng thái', value: user?.status },
                {
                  label: 'Phân quyền',
                  value: isSuperAdmin()
                    ? '* (Toàn quyền)'
                    : `${user?.permissions?.length ?? 0} quyền`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm py-3 border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                  <span className="text-slate-500 dark:text-slate-400">
                    {label}
                  </span>

                  <span className="font-medium text-slate-800 dark:text-slate-200 break-all sm:text-right">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className=" lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Đổi mật khẩu</p>
          </div>
          <form onSubmit={handleChangePassword} className="p-5 space-y-4">
            <PasswordInput
              label="Mật khẩu hiện tại"
              value={pwForm.old_password}
              onChange={val => setPwForm(f => ({ ...f, old_password: val }))}
              show={showPw.old}
              toggle={() => setShowPw(s => ({ ...s, old: !s.old }))}
            />
            <PasswordInput
              label="Mật khẩu mới (≥ 6 ký tự)"
              value={pwForm.new_password}
              onChange={val => setPwForm(f => ({ ...f, new_password: val }))}
              show={showPw.new_}
              toggle={() => setShowPw(s => ({ ...s, new_: !s.new_ }))}
              placeholder="Ít nhất 6 ký tự"
            />
            <PasswordInput
              label="Xác nhận mật khẩu mới"
              value={pwForm.confirm}
              onChange={val => setPwForm(f => ({ ...f, confirm: val }))}
              show={showPw.confirm}
              toggle={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
            />

            {pwError && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5 border border-red-100 dark:border-red-900/50">
                <AlertCircle className="w-4 h-4 shrink-0" />{pwError}
              </div>
            )}
            {pwOk && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2.5 border border-emerald-100 dark:border-emerald-800/50">
                <CheckCircle className="w-4 h-4 shrink-0" />Đổi mật khẩu thành công!
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </Button>
          </form>
        </div>

        {/* Permissions Detail */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quyền hạn đang hoạt động</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Quyền được tải từ database tại thời điểm đăng nhập</p>
            </div>
          </div>
          <div className="p-4">
            {isSuperAdmin() ? (
              <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/50">
                <span className="text-3xl">⭐</span>
                <div>
                  <p className="font-bold text-amber-800 dark:text-amber-400">Wildcard Permission (*)</p>
                  <p className="text-sm text-amber-600 dark:text-amber-500/80 font-medium">Super Admin — Toàn quyền không giới hạn trên tất cả resource</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(user?.permissions || []).map(pStr => {
                  const [code, scope] = pStr.split(':');
                  const scopeColor = scope === 'global' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' : scope === 'organization' ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30' : scope === 'department' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800';
                  return (
                    <div key={pStr} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="min-w-0">
                        <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 block truncate">{code}</code>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{PERMISSION_LABELS[code] || ''}</p>
                      </div>
                      {scope && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${scopeColor}`}>{scope[0]?.toUpperCase()}</span>}
                    </div>
                  );
                })}
                {!user?.permissions?.length && (
                  <p className="col-span-full text-center text-slate-400 dark:text-slate-600 text-sm py-6">Chưa có quyền nào được gán</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security & 2FA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bảo mật nâng cao (2FA)</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Xác thực 2 bước bằng ứng dụng Authenticator</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${is2FAEnabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Xác thực 2 bước (TOTP)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {is2FAEnabled ? 'Tài khoản của bạn đã được bảo vệ.' : 'Chưa được kích hoạt.'}
                  </p>
                </div>
              </div>
              <Button variant={is2FAEnabled ? 'outline' : 'default'} onClick={handleToggle2FA}>
                {is2FAEnabled ? 'Tắt 2FA' : 'Bật 2FA'}
              </Button>
            </div>

            {show2FASetup && setup2FAData && (
              <div className="mt-4 p-4 border border-emerald-200 dark:border-emerald-900/50 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Cài đặt mã Authenticator</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Quét mã QR bằng Google Authenticator hoặc Microsoft Authenticator.</p>
                <div className="flex gap-4">
                  <div className="bg-white dark:bg-slate-950 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                    <img src={setup2FAData.qr_code_url} alt="QR Code" className="w-24 h-24" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label className="text-xs">Mã bảo mật</Label>
                      <code className="block p-1.5 bg-white dark:bg-slate-950 rounded text-xs font-mono text-center border border-slate-200 dark:border-slate-800 mt-1">{setup2FAData.secret}</code>
                    </div>
                    <div>
                      <Label className="text-xs">Nhập mã OTP (6 số)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input placeholder="123456" value={otpCode} onChange={e => setOtpCode(e.target.value)} maxLength={6} className="text-center tracking-widest font-mono" />
                        <Button onClick={handleVerify2FA} disabled={otpCode.length !== 6 || verifying2FA}>
                          {verifying2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Thiết bị đang đăng nhập</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Quản lý các phiên hoạt động</p>
              </div>
            </div>
            {sessions.length > 1 && (
              <Button variant="ghost" size="sm" onClick={handleRevokeAll} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs h-8">
                <LogOut className="w-3.5 h-3.5 mr-1.5" /> Đăng xuất thiết bị khác
              </Button>
            )}
          </div>
          <div className="p-0">
            {loadingSessions ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {s.device.toLowerCase().includes('iphone') || s.device.toLowerCase().includes('mobile') ? (
                          <Smartphone className="w-5 h-5 text-slate-500" />
                        ) : (
                          <Laptop className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {s.device}
                          {s.is_current && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded-full uppercase tracking-wider font-bold">Hiện tại</span>}
                          {s.trusted && <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full uppercase tracking-wider font-bold">Trusted</span>}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {s.location} ({s.ip})</span>
                          <span>•</span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">{s.client_id || 'web_portal'}</span>
                          <span>•</span>
                          <span>{s.last_active}</span>
                        </div>
                      </div>
                    </div>
                    {!s.is_current && (
                      <Button variant="ghost" size="icon" onClick={() => handleRevokeSession(s.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" title="Đăng xuất khỏi thiết bị này">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
