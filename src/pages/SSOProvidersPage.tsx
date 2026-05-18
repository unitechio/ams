import React, { useCallback, useEffect, useState } from 'react';
import { Globe2, Loader2, Plus, RefreshCcw, Shield, Trash2, Waypoints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter, AdminToolbar } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { ssoProvidersAdminApi, type AdminSSOProvider, type PaginatedResponse } from '@/lib/api';
import { toast } from 'sonner';

export default function SSOProvidersPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<AdminSSOProvider> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminSSOProvider | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ssoProvidersAdminApi.list({ search, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách SSO provider');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

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
          await ssoProvidersAdminApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.provider_id}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa SSO provider."
      />

      <PageHeader
        title="SSO Providers"
        subtitle="Danh sách provider OIDC/OAuth2/SAML. Form create/edit đã được tách sang editor page riêng."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.CLIENT_CREATE}>
              <Button onClick={() => navigate('/sso-providers/create')}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <AdminCard>
        <AdminToolbar>
          <AdminSearchField>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo provider_id, name, type" className="pl-9" />
          </AdminSearchField>
        </AdminToolbar>
        {loading ? (
          <AdminLoadingState><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></AdminLoadingState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client / Scope</TableHead>
                  <TableHead>Callback</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {rows.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{provider.provider_id}</div>
                        <div className="text-xs text-slate-400">{provider.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {provider.type === 'saml' ? <Waypoints className="h-4 w-4 text-violet-500" /> : <Globe2 className="h-4 w-4 text-emerald-500" />}
                          <span>{provider.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{provider.client_id || 'N/A'}</div>
                        <div className="text-slate-400">{provider.scope || 'No scope'}</div>
                      </TableCell>
                      <TableCell className="text-xs">{provider.redirect_uri || provider.saml_login_url || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className={provider.enabled ? 'text-emerald-600' : 'text-slate-400'}>{provider.enabled ? 'Enabled' : 'Disabled'}</span>
                          <span className={provider.allow_auto_provision ? 'text-blue-600' : 'text-slate-400'}>{provider.allow_auto_provision ? 'Auto provision' : 'Manual link'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/sso-providers/${provider.id}/edit`)}>
                            <Shield className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(provider); setStepUpOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {result && result.total > result.page_size && (
              <AdminTableFooter>
                <Pagination total={result.total} page={result.page} pageSize={result.page_size} onPageChange={setPage} />
              </AdminTableFooter>
            )}
          </>
        )}
      </AdminCard>
    </div>
  );
}
