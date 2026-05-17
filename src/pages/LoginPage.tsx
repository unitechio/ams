import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Loader2, Mail, KeyRound, ArrowLeft, Lock, Fingerprint, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi, type SSOProvider } from '@/lib/api';
import { DEFAULT_AUTH_CLIENT, getDeviceFingerprint, getDeviceName } from '@/lib/device';

export default function LoginPage() {
  const { login, mustChangePassword, passwordChangeReason, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'login' | '2fa' | 'change_password' | 'forgot_password' | 'reset_sent'>('login');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  // 2FA State
  const [otp, setOtp] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [otpPrompt, setOtpPrompt] = useState<'email' | 'totp'>('totp');
  
  // Forgot Password State
  const [email, setEmail] = useState('');

  // Force Change Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [ssoProviders, setSSOProviders] = useState<SSOProvider[]>([]);

  // When AuthContext signals mustChangePassword (e.g. after successful login)
  useEffect(() => {
    if (mustChangePassword) setStep('change_password');
  }, [mustChangePassword]);

  useEffect(() => {
    authApi.ssoProviders().then(setSSOProviders).catch(() => setSSOProviders([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (failCount >= 5) {
      setError('Tài khoản đã bị tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau 30 phút.');
      return;
    }

    setLoading(true);
    try {
      if (step === '2fa') {
        if (otp.length !== 6) throw new Error('Mã OTP không hợp lệ');
      }

      const resp = await login(username, password, {
        ...DEFAULT_AUTH_CLIENT,
        device_name: getDeviceName(),
        device_fingerprint: getDeviceFingerprint(),
        otp_code: step === '2fa' ? otp : undefined,
        trust_device: trustDevice,
      });
      if (resp.must_change_password || resp.password_expired || resp.one_time_password || resp.require_password_change) {
        setStep('change_password');
        return;
      }
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      if (msg.toLowerCase().includes('otp')) {
        setOtpPrompt(msg.toLowerCase().includes('thiết bị') ? 'email' : 'totp');
        setStep('2fa');
        setError(msg);
        return;
      }
      setFailCount(f => f + 1);
      // Map common backend error messages to Vietnamese
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('wrong')) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
      } else if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('disabled')) {
        setError('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
      } else if (msg.toLowerCase().includes('inactive')) {
        setError('Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(password, newPassword);
      clearMustChangePassword();
      setPassword('');
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('reset_sent');
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Auth System</h1>
            <p className="text-emerald-100 text-sm mt-1">Hệ thống quản trị phân quyền</p>
          </div>

          {/* Forms based on step */}
          {step === 'login' && (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="username">Tên đăng nhập</Label>
                <Input
                  id="username"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <button type="button" onClick={() => { setStep('forgot_password'); setError(''); }} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {failCount > 0 && failCount < 5 && !error && (
                <div className="text-xs text-amber-600 text-center">
                  Bạn còn {5 - failCount} lần thử trước khi bị khóa tạm thời.
                </div>
              )}

              <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-semibold" disabled={loading || failCount >= 5}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang xử lý...</> : 'Đăng nhập'}
              </Button>

              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Ghi nhớ thiết bị này để giảm yêu cầu OTP cho các lần đăng nhập sau
              </label>

              {/* Demo accounts */}
              <div className="border-t border-gray-100 pt-4">
                {ssoProviders.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {ssoProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        type="button"
                        variant="outline"
                        className="w-full h-10"
                        onClick={async () => {
                          const { redirect_url } = await authApi.startSSO(provider.id);
                          window.location.href = redirect_url;
                        }}
                      >
                        Đăng nhập với {provider.name}
                      </Button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 text-center mb-3">Tài khoản demo</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { user: 'superadmin', label: 'Super Admin', color: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' },
                    { user: 'admin', label: 'Admin', color: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' },
                    { user: 'operator', label: 'Operator', color: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' },
                  ].map(({ user, label, color }) => (
                    <button
                      key={user}
                      type="button"
                      onClick={() => { setUsername(user); setPassword('Admin@123'); setError(''); setFailCount(0); }}
                      className={`text-[11px] border px-2 py-1.5 rounded-lg font-medium transition-colors ${color}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {step === '2fa' && (
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Fingerprint className="w-6 h-6 text-slate-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Xác thực 2 bước</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {otpPrompt === 'email'
                    ? 'Mã OTP đã được gửi tới email của bạn. Nhập mã để xác minh thiết bị đăng nhập.'
                    : 'Vui lòng nhập mã OTP từ ứng dụng Authenticator của bạn để tiếp tục.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-center block">Mã OTP (6 số)</Label>
                <Input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  className="text-center text-xl tracking-[0.5em] font-mono h-12"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-semibold" disabled={loading || otp.length !== 6}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang xác thực...</> : 'Xác nhận OTP'}
              </Button>
              
              <button type="button" onClick={() => { setStep('login'); setOtp(''); setError(''); }} className="w-full text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
              </button>
            </form>
          )}

          {step === 'change_password' && (
            <form onSubmit={handleForceChangePassword} className="p-8 space-y-5">
              <div className="text-center mb-2">
                <div className="w-14 h-14 bg-amber-50 border-2 border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-7 h-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Đổi mật khẩu bắt buộc</h2>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  {passwordChangeReason === 'password_expired'
                    ? <>Mật khẩu hiện tại đã <strong>hết hạn</strong>.<br />Vui lòng đặt mật khẩu mới để tiếp tục.</>
                    : <>Tài khoản của bạn đang dùng <strong>mật khẩu tạm thời</strong>.<br />Vui lòng đặt mật khẩu mới để tiếp tục.</>}
                </p>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="new_pw">Mật khẩu mới <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    id="new_pw"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Tối thiểu 8 ký tự"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="pl-9 pr-10 h-11"
                    required
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm_pw">Xác nhận mật khẩu mới <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    id="confirm_pw"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`pl-9 pr-10 h-11 ${confirmPassword && newPassword !== confirmPassword ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Mật khẩu xác nhận không khớp
                  </p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Mật khẩu khớp
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang lưu...</>
                  : 'Đặt mật khẩu mới & Tiếp tục'
                }
              </Button>

              {/* Password strength hints */}
              <ul className="text-[11px] text-slate-400 space-y-0.5 pl-4 list-disc">
                <li className={newPassword.length >= 8 ? 'text-emerald-500' : ''}>Ít nhất 8 ký tự</li>
                <li className={/[A-Z]/.test(newPassword) ? 'text-emerald-500' : ''}>Có ít nhất 1 chữ hoa</li>
                <li className={/[a-z]/.test(newPassword) ? 'text-emerald-500' : ''}>Có ít nhất 1 chữ thường</li>
                <li className={/[0-9]/.test(newPassword) ? 'text-emerald-500' : ''}>Có ít nhất 1 chữ số</li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-500' : ''}>Có ít nhất 1 ký tự đặc biệt</li>
              </ul>
            </form>
          )}

          {step === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="p-8 space-y-5">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Khôi phục mật khẩu</h2>
                <p className="text-sm text-slate-500 mt-1">Nhập email liên kết với tài khoản của bạn để nhận link đặt lại mật khẩu.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-9 h-11"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold" disabled={loading || !email}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang gửi...</> : 'Gửi yêu cầu'}
              </Button>
              
              <button type="button" onClick={() => { setStep('login'); setEmail(''); }} className="w-full text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
              </button>
            </form>
          )}

          {step === 'reset_sent' && (
            <div className="p-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Đã gửi email khôi phục</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Chúng tôi đã gửi link đặt lại mật khẩu đến email <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến (và thư rác).
                </p>
              </div>
              <Button onClick={() => { setStep('login'); setEmail(''); }} className="w-full h-11" variant="outline">
                Quay lại đăng nhập
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Auth System v1.0 · Powered by Go + React
        </p>
      </div>
    </div>
  );
}
