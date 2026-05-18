import React, { useCallback, useEffect, useState } from 'react';
import { Laptop, Loader2, RefreshCcw, Shield, Smartphone, Trash2 } from 'lucide-react';
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter, AdminToolbar } from '@/components/layout/AdminShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { devicesApi, type DeviceSession, type PaginatedResponse } from '@/lib/api';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
import { toast } from 'sonner';

export default function DevicesPage() {
  const [result, setResult] = useState<PaginatedResponse<DeviceSession> | null>(null);
  const [search, setSearch] = useState('');
  const [clientID, setClientID] = useState('all');
  const [trusted, setTrusted] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [targetSession, setTargetSession] = useState<DeviceSession | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await devicesApi.list({
        search,
        client_id: clientID === 'all' ? undefined : clientID,
        trusted: trusted === 'all' ? undefined : trusted,
        page,
        page_size: 20,
      });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  }, [search, clientID, trusted, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (!targetSession) return;
          await devicesApi.revoke(targetSession.id);
          toast.success(`Đã thu hồi thiết bị ${targetSession.device}`);
          setTargetSession(null);
          fetchData();
        }}
        description="Xác thực lại để thu hồi phiên thiết bị này."
      />

      <PageHeader
        title="Quản lý thiết bị"
        subtitle="Theo dõi thiết bị đăng nhập, trusted device và thu hồi phiên theo từng thiết bị"
        actions={
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Làm mới
          </Button>
        }
      />

      <AdminCard>
        <AdminToolbar>
          <AdminSearchField>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo user, email, device, IP, client"
              className="pl-9"
            />
          </AdminSearchField>
          <Select value={clientID} onValueChange={(value) => { setClientID(value); setPage(1); }}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả client</SelectItem>
              <SelectItem value="web_portal">Web Portal</SelectItem>
              <SelectItem value="crm_portal">CRM Portal</SelectItem>
              <SelectItem value="mobile_app_tpv_public">Mobile App</SelectItem>
            </SelectContent>
          </Select>
          <Select value={trusted} onValueChange={(value) => { setTrusted(value); setPage(1); }}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Trusted" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="true">Trusted</SelectItem>
              <SelectItem value="false">Untrusted</SelectItem>
            </SelectContent>
          </Select>
        </AdminToolbar>

        {loading ? (
          <AdminLoadingState>
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </AdminLoadingState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Trusted</TableHead>
                  <TableHead>Hoạt động cuối</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {(result?.data || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-800">{item.username}</div>
                        <div className="text-xs text-slate-400">{item.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.device.toLowerCase().includes('mobile') ? <Smartphone className="h-4 w-4 text-slate-400" /> : <Laptop className="h-4 w-4 text-slate-400" />}
                          <span>{item.device}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.client_id}</TableCell>
                      <TableCell className="font-mono text-xs">{item.ip}</TableCell>
                      <TableCell>
                        {item.trusted ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Shield className="mr-1 h-3 w-3" /> Trusted
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">{item.last_active}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTargetSession(item);
                            setStepUpOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {result && result.total > 0 && (
              <AdminTableFooter>
                <Pagination
                  page={result.page}
                  pageSize={result.page_size}
                  total={result.total}
                  onPageChange={setPage}
                />
              </AdminTableFooter>
            )}
          </>
        )}
      </AdminCard>
    </div>
  );
}
