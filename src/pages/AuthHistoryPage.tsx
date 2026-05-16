import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, AlertCircle, RefreshCcw, Shield,
  Monitor, MapPin, Clock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { logsApi, type PaginatedResponse } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuthHistoryEntry {
  id: number;
  username: string;
  ip_address: string;
  user_agent: string;
  status: string;
  note: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  cls: string;
}> = {
  success: {
    label: 'Thành công',
    icon: CheckCircle2,
    cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50',
  },
  failed: {
    label: 'Thất bại',
    icon: XCircle,
    cls: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/50',
  },
  locked: {
    label: 'Bị khóa',
    icon: AlertTriangle,
    cls: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/50',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    icon: Shield,
    cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  };
  const Icon = cfg.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
      cfg.cls
    )}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function parseUA(ua: string) {
  if (!ua) return '—';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('curl')) return 'curl';
  if (ua.includes('PostmanRuntime')) return 'Postman';
  return ua.length > 40 ? ua.slice(0, 40) + '…' : ua;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StatBox({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', cls)}>
        <Shield className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none mt-0.5 font-outfit">{value}</p>
      </div>
    </div>
  );
}

export default function AuthHistoryPage() {
  const [result, setResult] = useState<PaginatedResponse<AuthHistoryEntry> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await logsApi.listAuth({ search, page, page_size: pageSize });
      setResult(res);
    } catch (e: any) {
      const msg = e?.message || 'Lỗi tải lịch sử đăng nhập';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const entries = result?.data ?? [];
  const successCount = entries.filter(e => e.status === 'success').length;
  const failedCount = entries.filter(e => e.status === 'failed').length;
  const lockedCount = entries.filter(e => e.status === 'locked').length;

  return (
    <div className="space-y-6">

      <PageHeader
        title="Lịch sử đăng nhập"
        subtitle="Theo dõi tất cả phiên xác thực để đảm bảo an ninh hệ thống"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Tổng phiên" value={result?.total ?? 0} cls="bg-slate-100 text-slate-500" />
        <StatBox label="Thành công" value={successCount} cls="bg-emerald-50 text-emerald-600" />
        <StatBox label="Thất bại" value={failedCount} cls="bg-red-50 text-red-500" />
        <StatBox label="Bị khóa" value={lockedCount} cls="bg-amber-50 text-amber-500" />
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <Input
              placeholder="Tìm theo username hoặc IP..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Cập nhật: {new Date().toLocaleTimeString('vi-VN')}</span>
            </div>
            <Button
              variant="ghost" size="icon"
              onClick={fetchData}
              className="h-9 w-9 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Làm mới"
            >
              <RefreshCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <AlertCircle className="w-10 h-10 text-red-300" />
            <p className="text-sm text-red-500 font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="rounded-lg">
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Thử lại
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Đang tải lịch sử...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tài khoản</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-36">Trạng thái</th>
                  <th className="hidden md:table-cell px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Địa chỉ IP</th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Thiết bị</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-40">Thời gian</th>
                  <th className="hidden xl:table-cell px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {!entries.length ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400 text-sm italic">
                      Chưa có lịch sử đăng nhập nào
                    </td>
                  </tr>
                ) : entries.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                    {/* Username */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase shrink-0">
                          {h.username?.charAt(0) ?? '?'}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{h.username}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={h.status} />
                    </td>

                    {/* IP */}
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                        <MapPin className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                        {h.ip_address || '—'}
                      </div>
                    </td>

                    {/* UA */}
                    <td className="hidden lg:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Monitor className="w-3 h-3 text-slate-300 shrink-0" />
                        {parseUA(h.user_agent)}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                        {formatTime(h.created_at)}
                      </span>
                    </td>

                    {/* Note */}
                    <td className="hidden xl:table-cell px-4 py-3">
                      <span className="text-[11px] text-slate-400 italic">
                        {h.note || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
          <Pagination
            total={result?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
