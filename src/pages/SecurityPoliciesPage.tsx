import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { securityPoliciesApi, type PaginatedResponse, type SecurityPolicy } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

export default function SecurityPoliciesPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<SecurityPolicy> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SecurityPolicy | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await securityPoliciesApi.list({ search, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải security policies');
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
          await securityPoliciesApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.code}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa security policy hoặc thay đổi policy có tác động runtime."
      />

      <PageHeader
        title="Security Policies"
        subtitle="Danh sách policy runtime. Form tạo/cập nhật đã được tách thành trang riêng để hiển thị đầy đủ field auth, password và step-up."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.POLICY_CREATE}>
              <Button onClick={() => navigate('/security-policies/create')}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo code, name, policy type, target client/channel" className="pl-9" />
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
                    <th className="px-4 py-3">Policy</th>
                    <th className="px-4 py-3">Type / Scope</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Runtime</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((policy) => (
                    <tr key={policy.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{policy.code}</div>
                        <div className="text-xs text-slate-400">{policy.name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" />{policy.policy_type}</div>
                        <div className="text-slate-400">{policy.scope_type} • p{policy.priority}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>{policy.target_client || 'all clients'}</div>
                        <div className="text-slate-400">{policy.target_channel || 'all channels'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {policy.policy_type === 'auth' ? (
                          <>
                            <div>{policy.config.require_mfa ? 'Require MFA' : 'MFA inherit/default'}</div>
                            <div className="text-slate-400">Pwd: {String(policy.config.allow_password ?? true)} • SSO: {String(policy.config.allow_sso ?? true)} • Refresh: {policy.config.refresh_ttl_minutes ?? 10080}m</div>
                          </>
                        ) : policy.policy_type === 'step_up' ? (
                          <>
                            <div>Action: {policy.target_action || 'N/A'}</div>
                            <div className="text-slate-400">Require step-up: {String(policy.config.require_step_up ?? true)}</div>
                          </>
                        ) : (
                          <>
                            <div>Min length: {policy.config.password_min_length ?? 8}</div>
                            <div className="text-slate-400">U:{String(policy.config.require_upper ?? true)} L:{String(policy.config.require_lower ?? true)} N:{String(policy.config.require_number ?? true)} S:{String(policy.config.require_special ?? true)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/security-policies/${policy.id}/edit`)}>
                            <ShieldAlert className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(policy); setStepUpOpen(true); }}>
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
