import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi, setToken } from '@/lib/api';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = params.get('code');
    const errorParam = params.get('error');
    if (errorParam) {
      setError(errorParam);
      return;
    }
    if (!code) {
      setError('Thiếu authorization code');
      return;
    }
    const verifier = localStorage.getItem('pkce_verifier');
    const clientID = localStorage.getItem('oauth_client_id') || 'web_portal';
    const redirectURI = `${window.location.origin}/oauth/callback`;
    if (!verifier) {
      setError('Thiếu PKCE verifier');
      return;
    }
    authApi.exchangeAuthorizationCode({
      client_id: clientID,
      code,
      redirect_uri: redirectURI,
      code_verifier: verifier,
    })
      .then((resp) => {
        setToken(resp.access_token);
        localStorage.setItem('access_token', resp.access_token);
        localStorage.removeItem('pkce_verifier');
        navigate('/');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'OAuth callback thất bại'));
  }, [navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900">OAuth callback lỗi</h1>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <h1 className="mt-4 text-lg font-semibold text-slate-900">Đang hoàn tất đăng nhập OAuth</h1>
            <p className="mt-2 text-sm text-slate-500">Hệ thống đang đổi authorization code lấy access token.</p>
          </>
        )}
      </div>
    </div>
  );
}
