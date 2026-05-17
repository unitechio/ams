import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { authApi, setToken } from '@/lib/api';
import { DEFAULT_AUTH_CLIENT, getDeviceFingerprint, getDeviceName } from '@/lib/device';

export default function SSOCallbackPage() {
  const { provider = '' } = useParams();
  const [params] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');
    if (errorParam) {
      setError(errorParam);
      return;
    }
    if (!provider || !code || !state) {
      setError('Thiếu dữ liệu callback từ nhà cung cấp SSO');
      return;
    }
    authApi.completeSSO(provider, {
      code,
      state,
      ...DEFAULT_AUTH_CLIENT,
      device_name: getDeviceName(),
      device_fingerprint: getDeviceFingerprint(),
      trust_device: true,
    })
      .then((resp) => {
        setToken(resp.access_token);
        localStorage.setItem('access_token', resp.access_token);
        localStorage.setItem('refresh_token', resp.refresh_token);
        window.location.replace('/');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Không thể hoàn tất đăng nhập SSO');
      });
  }, [params, provider]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Đăng nhập SSO thất bại</h1>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Đang hoàn tất đăng nhập SSO</h1>
            <p className="mt-2 text-sm text-slate-500">Hệ thống đang xác thực callback từ nhà cung cấp danh tính.</p>
          </>
        )}
      </div>
    </div>
  );
}
