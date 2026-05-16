import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, FileText, User, Activity, Globe,
  CheckCircle2, XCircle, Filter, Eye, RefreshCcw, X,
  ArrowRight, Database, Terminal, Clock
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { logsApi, type PaginatedResponse } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';

interface AuditLog {
  id: number;
  username: string;
  action: string;
  resource: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  request: string;
  response: string;
  allowed: boolean;
  created_at: string;
}

const PAGE_SIZE = 15;

function StatBox({ label, value, icon: Icon, color }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-none mt-0.5 font-outfit">{value}</p>
      </div>
    </div>
  );
}

function JsonViewer({ data, title, color }: { data: string; title: string; color: string }) {
  let content = '// No data';
  try {
    if (data) {
      const parsed = JSON.parse(data);
      content = JSON.stringify(parsed, null, 2);
    }
  } catch {
    content = data || '// Empty';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("w-1.5 h-4 rounded-full", color)} />
        <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider font-outfit">{title}</span>
      </div>
      <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto border border-slate-800 shadow-inner group relative">
        <pre className={cn("text-[11px] font-mono leading-relaxed", color.replace('bg-', 'text-'))}>
          {content}
        </pre>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const [result, setResult] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ user: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logsApi.listAudit({
        search,
        ...filters,
        page,
        page_size: PAGE_SIZE
      });
      setResult(res);
    } catch (e: any) {
      toast.error('Lỗi tải nhật ký hệ thống');
    } finally {
      setLoading(false);
    }
  }, [search, filters, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetFilters = () => {
    setSearch('');
    setFilters({ user: '', action: '', from: '', to: '' });
    setPage(1);
  };

  const logs = result?.data ?? [];
  const allowedCount = logs.filter(l => l.allowed).length;
  const deniedCount = logs.filter(l => !l.allowed).length;

  return (
    <AdminLayout>
      <PageHeader title="Nhật ký tác động" subtitle="Truy vết chi tiết mọi hành động và thay đổi trên hệ thống" />
      <div className="space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Tổng tác động" value={result?.total ?? 0} icon={Activity} color="bg-slate-100 text-slate-500" />
          <StatBox label="Hợp lệ" value={allowedCount} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
          <StatBox label="Bị chặn" value={deniedCount} icon={XCircle} color="bg-red-50 text-red-500" />
          <StatBox label="Tài nguyên" value={new Set(logs.map(l => l.resource)).size} icon={Database} color="bg-blue-50 text-blue-600" />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Tìm nội dung request, response, tài nguyên..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 text-sm focus-visible:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-9 rounded-lg px-4 border-slate-200 transition-all",
                  showFilters && "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}
              >
                <Filter className="w-3.5 h-3.5 mr-2" />
                Bộ lọc nâng cao
              </Button>
              {(search || Object.values(filters).some(v => v)) && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 rounded-lg text-slate-400 hover:text-slate-800">
                  Xóa lọc
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={fetchData} className="h-9 w-9 text-slate-400 hover:bg-slate-50">
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người dùng</Label>
                <Input
                  placeholder="Username..."
                  value={filters.user}
                  onChange={e => setFilters(f => ({ ...f, user: e.target.value }))}
                  className="h-8 rounded-md bg-white text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hành động</Label>
                <Input
                  placeholder="Action code..."
                  value={filters.action}
                  onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                  className="h-8 rounded-md bg-white text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Từ ngày</Label>
                <Input
                  type="date"
                  value={filters.from}
                  onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                  className="h-8 rounded-md bg-white text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đến ngày</Label>
                <Input
                  type="date"
                  value={filters.to}
                  onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                  className="h-8 rounded-md bg-white text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-400">Đang truy vấn nhật ký...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Người dùng</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hành động</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tài nguyên</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28">Kết quả</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-40">Thời gian</th>
                    <th className="px-4 py-2.5 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!result?.data.length ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400 text-sm italic">
                        Không tìm thấy bản ghi nào
                      </td>
                    </tr>
                  ) : result.data.map(log => (
                    <tr
                      key={log.id}
                      className="group hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 text-[11px] font-bold uppercase shrink-0">
                            {log.username.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800 text-sm">{log.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-300" />
                          <code className="text-[11px] font-mono bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-100">
                            {log.action}
                          </code>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <FileText className="w-3 h-3 opacity-50" /> {log.resource}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono italic opacity-70">ID: {log.resource_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.allowed ? (
                          <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Allowed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-500 hover:bg-red-50 border-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Denied
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <Pagination total={result?.total ?? 0} page={page} pageSize={15} onPageChange={setPage} />
          </div>
        </div>
      </div>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className={cn(
            "px-6 py-5 relative overflow-hidden shrink-0",
            selectedLog?.allowed ? "bg-emerald-600" : "bg-red-600"
          )}>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Terminal className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-white text-base font-semibold">Chi tiết nhật ký tác động</DialogTitle>
                  <DialogDescription className="text-white/80 text-xs mt-0.5">
                    Mã bản ghi: <code className="bg-white/20 px-1.5 py-0.5 rounded">#{selectedLog?.id}</code>
                  </DialogDescription>
                </div>
              </div>
              <div className="bg-white/20 px-3 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/30">
                {selectedLog?.allowed ? 'Thành công' : 'Bị từ chối'}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Người thực hiện
                </p>
                <p className="text-sm font-bold text-slate-900">{selectedLog?.username}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Hành động
                </p>
                <code className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{selectedLog?.action}</code>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Nguồn (IP)
                </p>
                <p className="text-sm font-bold text-slate-900 font-mono">{selectedLog?.ip_address}</p>
              </div>
            </div>

            {/* Resource Info */}
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium border-b border-slate-100 pb-2">
              <Database className="w-3.5 h-3.5" />
              <span>Tài nguyên:</span>
              <span className="text-slate-900 font-bold capitalize">{selectedLog?.resource}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-slate-400">ID:</span>
              <span className="text-slate-900 font-mono">{selectedLog?.resource_id}</span>
            </div>

            {/* JSON Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <JsonViewer
                title="Dữ liệu yêu cầu (Request)"
                data={selectedLog?.request || ''}
                color="bg-emerald-500"
              />
              <JsonViewer
                title="Kết quả phản hồi (Response)"
                data={selectedLog?.response || ''}
                color="bg-blue-500"
              />
            </div>

            {/* Agent */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Thiết bị & Trình duyệt (User Agent)
              </p>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">{selectedLog?.user_agent}</p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-row justify-end gap-2">
            <span className="mr-auto text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> {new Date(selectedLog?.created_at || '').toLocaleString('vi-VN')}
            </span>
            <Button onClick={() => setSelectedLog(null)} className="h-9 px-6 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold">
              Đóng chi tiết
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
