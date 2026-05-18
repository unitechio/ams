import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Search, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { loginChannelsApi, type LoginChannel, type PaginatedResponse } from '@/lib/api';
import { toast } from 'sonner';

export default function LoginChannelsPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<LoginChannel> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LoginChannel | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loginChannelsApi.list({ search, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải login channels');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = result?.data || [];

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!deleteTarget) return;
          await loginChannelsApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.code}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa login channel."
      />

      <PageHeader
        title="Login Channels"
        subtitle="Quản lý bề mặt đăng nhập. Form create/edit đã được tách sang editor page riêng."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.CHANNEL_CREATE}>
              <Button onClick={() => navigate('/login-channels/create')}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo code, name, description" className="pl-9" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-400 dark:bg-slate-950/60">
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3">TTL</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((channel) => (
                    <tr key={channel.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{channel.code}</div>
                        <div className="text-xs text-slate-400">{channel.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Workflow className="h-4 w-4 text-slate-400" />
                          <span className="dark:text-slate-200">{channel.risk_level}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>{channel.allow_password ? 'Password' : 'No password'} {channel.allow_sso ? '• SSO' : ''}</div>
                        <div>{channel.require_mfa ? 'MFA required' : 'MFA optional'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>Trusted: {channel.trusted_device_ttl_hours}h</div>
                        <div>Session: {channel.session_ttl_minutes}m</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-xs">
                          <span className={channel.active ? 'text-emerald-600' : 'text-slate-400'}>{channel.active ? 'Active' : 'Disabled'}</span>
                          <span className={channel.require_mfa ? 'text-violet-600' : 'text-slate-400'}>{channel.require_mfa ? 'Step-up' : 'Standard'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/login-channels/${channel.id}/edit`)}>
                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(channel); setStepUpOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result && result.total > result.page_size && (
              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <Pagination total={result.total} page={result.page} pageSize={result.page_size} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
