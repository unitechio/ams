import React, { useCallback, useEffect, useState } from 'react';
import { Laptop, Loader2, RefreshCcw, Search, Shield, Smartphone, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
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

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo user, email, device, IP, client"
              className="pl-9"
            />
          </div>
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Người dùng</th>
                    <th className="px-4 py-3">Thiết bị</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Trusted</th>
                    <th className="px-4 py-3">Hoạt động cuối</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.data || []).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{item.username}</div>
                        <div className="text-xs text-slate-400">{item.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.device.toLowerCase().includes('mobile') ? <Smartphone className="h-4 w-4 text-slate-400" /> : <Laptop className="h-4 w-4 text-slate-400" />}
                          <span>{item.device}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{item.client_id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.ip}</td>
                      <td className="px-4 py-3">
                        {item.trusted ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            <Shield className="mr-1 h-3 w-3" /> Trusted
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.last_active}</td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result && result.total_pages > 1 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <Pagination
                  page={result.page}
                  pageSize={result.page_size}
                  total={result.total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
