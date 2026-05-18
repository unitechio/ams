import React, { useCallback, useEffect, useState } from 'react';
import { AppWindow, Bot, Copy, KeyRound, Loader2, Plus, RefreshCcw, RotateCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter, AdminToolbar } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { clientsApi, copyText, serviceAccountsApi, type AuthClient, type PaginatedResponse } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

type Mode = 'all' | 'service';
type StepUpAction =
  | { type: 'delete'; client: AuthClient }
  | { type: 'rotate'; client: AuthClient }
  | null;

function secretStatus(client: AuthClient) {
  if (client.public) return 'Public / no secret';
  if (!client.secret_expires_at) return `v${client.secret_version}`;
  const expiresAt = new Date(client.secret_expires_at);
  const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Expired v${client.secret_version}`;
  return `v${client.secret_version} • ${diffDays}d left`;
}

export function AuthClientsManager({ mode = 'all' }: { mode?: Mode }) {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<AuthClient> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<StepUpAction>(null);

  const isServiceMode = mode === 'service';
  const appType = isServiceMode ? 'internal_service' : undefined;
  const clientApi = isServiceMode ? serviceAccountsApi : clientsApi;
  const createPath = isServiceMode ? '/service-accounts/create' : '/auth-clients/create';
  const editPath = (id: number) => isServiceMode ? `/service-accounts/${id}/edit` : `/auth-clients/${id}/edit`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = isServiceMode
        ? await serviceAccountsApi.list({ search, page, page_size: 20 })
        : await clientsApi.list({ search, app_type: appType, page, page_size: 20 });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải auth clients');
    } finally {
      setLoading(false);
    }
  }, [search, appType, page, isServiceMode]);

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
          if (!stepUpAction) return;
          if (stepUpAction.type === 'delete') {
            await clientApi.delete(stepUpAction.client.id);
            toast.success(`Đã xóa ${stepUpAction.client.client_id}`);
          } else {
            const updated = await clientApi.rotateSecret(stepUpAction.client.id);
            toast.success(`Đã rotate client secret cho ${updated.client_id}`);
          }
          setStepUpAction(null);
          fetchData();
        }}
        description={stepUpAction?.type === 'rotate'
          ? 'Xác thực lại để rotate client secret và tăng secret version.'
          : 'Xác thực lại để xóa auth client hoặc service account.'}
      />

      <PageHeader
        title={isServiceMode ? 'Service Accounts' : 'OAuth Clients'}
        subtitle={isServiceMode
          ? 'Machine-to-machine clients cho cronjob, worker, integration và internal API'
          : 'Danh sách application client. Form create/edit đã được tách sang trang riêng để thao tác dễ hơn và không còn vỡ layout dialog.'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={isServiceMode ? PERMISSIONS.SERVICE_CREATE : PERMISSIONS.CLIENT_CREATE}>
              <Button data-tour={isServiceMode ? undefined : 'auth-clients-create-button'} onClick={() => navigate(createPath)}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <AdminCard>
        <AdminToolbar>
          <AdminSearchField>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo client_id, name, owner team, domain group" className="pl-9" />
          </AdminSearchField>
        </AdminToolbar>
        {loading ? (
          <AdminLoadingState><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></AdminLoadingState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Template / Scope</TableHead>
                  <TableHead>Grant / Security</TableHead>
                  <TableHead>Audience / Channel</TableHead>
                  <TableHead>Approval / Secret</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {rows.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="align-top">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{client.client_id}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{client.name}</div>
                        <div className="text-[11px] text-slate-400">{client.domain_group} • {client.environment} • {client.owner_team || 'unassigned'}</div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <div className="flex items-center gap-2">
                          {client.app_type === 'internal_service' ? <Bot className="h-4 w-4 text-emerald-500" /> : <AppWindow className="h-4 w-4 text-slate-400" />}
                          <span>{client.client_template || client.app_type}</span>
                        </div>
                        <div className="mt-1">{client.tags.join(', ') || 'no tags'}</div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <div>{client.grant_types.join(', ')}</div>
                        <div className="mt-1 text-slate-400">
                          {client.public ? 'Public' : 'Confidential'}
                          {client.pkce_required ? ' • PKCE' : ''}
                          {client.legacy_password_grant ? ' • Legacy password' : ''}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <div>{client.audiences.join(', ')}</div>
                        <div className="mt-1 text-slate-400">{client.channels.join(', ')}</div>
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        <div className={client.approval_status === 'approved' ? 'text-emerald-600' : client.approval_status === 'pending' ? 'text-amber-600' : 'text-red-500'}>
                          {client.approval_status}
                        </div>
                        <div className="mt-1 text-slate-400">{secretStatus(client)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={async () => {
                            try {
                              await copyText(client.client_secret || '');
                              toast.success('Đã sao chép client secret');
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Không thể sao chép client secret');
                            }
                          }} disabled={client.public}>
                            <Copy className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => navigate(editPath(client.id))}>
                            <KeyRound className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setStepUpAction({ type: 'rotate', client }); setStepUpOpen(true); }} disabled={client.public}>
                            <RotateCw className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setStepUpAction({ type: 'delete', client }); setStepUpOpen(true); }}>
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

const AuthClientsPage: React.FC = () => <AuthClientsManager />;

export default AuthClientsPage;
