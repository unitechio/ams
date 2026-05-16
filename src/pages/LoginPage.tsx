import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Loader2, Mail, KeyRound, ArrowLeft, Lock, Fingerprint, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'login' | '2fa' | 'forgot_password' | 'reset_sent'>('login');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  // 2FA State
  const [otp, setOtp] = useState('');
  
  // Forgot Password State
  const [email, setEmail] = useState('');
  
  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failCount, setFailCount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simulate Bruteforce block
    if (failCount >= 5) {
      setError('Tài khoản đã bị tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau 15 phút.');
      return;
    }

    setLoading(true);
    try {
      // Mock logic for step-up authentication requirement
      if (username === 'superadmin' && step === 'login') {
        // Assume superadmin requires 2FA
        setStep('2fa');
        setLoading(false);
        return;
      }

      if (step === '2fa') {
        if (otp.length !== 6) {
          throw new Error('Mã OTP không hợp lệ');
        }
      }

      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      setFailCount(f => f + 1);
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
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

              {/* Demo accounts */}
              <div className="border-t border-gray-100 pt-4">
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
                <p className="text-sm text-slate-500 mt-1">Vui lòng nhập mã OTP từ ứng dụng Authenticator của bạn để tiếp tục.</p>
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
