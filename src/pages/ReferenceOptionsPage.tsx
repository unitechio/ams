import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCcw, Settings2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminCard, AdminLoadingState, AdminSearchField, AdminToolbar } from '@/components/layout/AdminShell';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { referenceOptionsApi, type PaginatedResponse, type ReferenceOption } from '@/lib/api';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';

export default function ReferenceOptionsPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<ReferenceOption> | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReferenceOption | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await referenceOptionsApi.list({
        search,
        option_group: groupFilter === 'all' ? undefined : groupFilter,
        page,
        page_size: 50,
      });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải reference options');
    } finally {
      setLoading(false);
    }
  }, [groupFilter, page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupOptions = useMemo(() => {
    const groups = Array.from(new Set((result?.data || []).map((item) => item.option_group).filter(Boolean)));
    return groups.sort();
  }, [result]);

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!deleteTarget) return;
          await referenceOptionsApi.delete(deleteTarget.id);
          toast.success(`Đã xóa ${deleteTarget.value}`);
          setDeleteTarget(null);
          fetchData();
        }}
        description="Xác thực lại để xóa reference option."
      />
      <PageHeader
        title="Reference Options"
        subtitle="Catalog DB-backed cho các dropdown và template runtime. Form create/edit đã được tách sang page riêng."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData}><RefreshCcw className="mr-2 h-4 w-4" />Làm mới</Button>
            <Guard permission={PERMISSIONS.OPTION_CREATE}>
              <Button onClick={() => navigate('/reference-options/create')}><Plus className="mr-2 h-4 w-4" />Thêm mới</Button>
            </Guard>
          </div>
        }
      />

      <AdminCard>
        <AdminToolbar>
          <AdminSearchField>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo group, value, label" className="pl-9" />
          </AdminSearchField>
          <Select value={groupFilter} onValueChange={(value) => { setGroupFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Lọc theo group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả group</SelectItem>
              {groupOptions.map((group) => (
                <SelectItem key={group} value={group}>{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AdminToolbar>
        {loading ? (
          <AdminLoadingState><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></AdminLoadingState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group / Value</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {(result?.data || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{item.option_group}</div>
                        <div className="text-xs text-slate-400">{item.value}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-700 dark:text-slate-200">{item.label}</div>
                        <div className="text-xs text-slate-400">{item.description || 'Không có mô tả'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        <div className="max-w-md truncate">{item.meta_json || '{}'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-emerald-500" />
                          {item.active ? `Active • #${item.sort_order}` : `Inactive • #${item.sort_order}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Guard permission={PERMISSIONS.OPTION_UPDATE}>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/reference-options/${item.id}/edit`)}>Sửa</Button>
                          </Guard>
                          <Guard permission={PERMISSIONS.OPTION_DELETE}>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-rose-600"
                              onClick={() => { setDeleteTarget(item); setStepUpOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Guard>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <Pagination
              total={result?.total || 0}
              page={result?.page || 1}
              pageSize={result?.page_size || 50}
              onPageChange={setPage}
            />
          </>
        )}
      </AdminCard>
    </div>
  );
}
