import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  FileText,
  User,
  Activity,
  Globe,
  CheckCircle2,
  XCircle,
  Filter,
  Eye,
  RefreshCcw,
  X,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Clock,
  Server,
  Monitor,
  Copy,
  ExternalLink,
  Zap,
  Terminal,
  Database,
  Fingerprint,
} from "lucide-react";
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logsApi, type PaginatedResponse } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

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

function StatusBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm shadow-emerald-50">
      <CheckCircle2 className="w-3 h-3" /> Allowed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-red-500 uppercase bg-red-50 px-2.5 py-1 rounded-full border border-red-100 shadow-sm shadow-red-50">
      <XCircle className="w-3 h-3" /> Denied
    </span>
  );
}

function JsonPreview({
  data,
  label,
  icon: Icon,
}: {
  data: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const content = (() => {
    if (!data) return "// No payload data available";
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  })();

  return (
    <div className="flex flex-col h-full min-h-[250px]">
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(content);
            toast.success(`Đã sao chép ${label}`);
          }}
          className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-emerald-600"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-b-xl border-x border-b border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-auto custom-scrollbar">
        <pre className="text-slate-700 dark:text-slate-300 leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const [result, setResult] = useState<PaginatedResponse<AuditLog> | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    user: "",
    action: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
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
        page_size: pageSize,
      });
      setResult(res);
    } catch (e: any) {
      toast.error("Lỗi tải nhật ký hệ thống");
    } finally {
      setLoading(false);
    }
  }, [search, filters, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetFilters = () => {
    setSearch("");
    setFilters({ user: "", action: "", from: "", to: "" });
    setPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Nhật ký tác động"
          subtitle="Hệ thống giám sát và truy vết chi tiết mọi thay đổi trên nền tảng"
          actions={
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              data-tour="audit-filters-toggle"
              className={cn(
                "h-10 rounded-xl",
                showFilters &&
                  "bg-emerald-50 text-emerald-600 border-emerald-100",
              )}
            >
              <Filter className="w-4 h-4 mr-2" /> Bộ lọc nâng cao
            </Button>
          }
        />

        {/* Search & Main Actions */}
        <AdminCard data-tour="audit-search" className="p-4 flex flex-wrap items-center justify-between gap-4">
          <AdminSearchField className="w-full sm:w-96 flex-none">
            <Input
              placeholder="Tìm nội dung, tài nguyên, ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 bg-slate-50/50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 focus-visible:ring-emerald-500 h-10 rounded-lg text-sm"
            />
          </AdminSearchField>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchData}
              className="h-10 w-10 text-slate-400 hover:text-slate-900"
            >
              <RefreshCcw className="w-4 h-4" />
            </Button>
            {(search || Object.values(filters).some((v) => v)) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-10 rounded-xl text-slate-400 hover:text-red-500"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </AdminCard>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div data-tour="audit-filters-panel" className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 dark:border-emerald-900/40 dark:bg-slate-900">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Người dùng
                </Label>
                <Input
                  placeholder="Username..."
                  value={filters.user}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, user: e.target.value }))
                  }
                  className="h-9 rounded-lg bg-slate-50/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Hành động
                </Label>
                <Input
                  placeholder="Action code..."
                  value={filters.action}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, action: e.target.value }))
                  }
                  className="h-9 rounded-lg bg-slate-50/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Từ ngày
                </Label>
                <DatePicker
                  value={filters.from}
                  onChange={(v) => setFilters((f) => ({ ...f, from: v || "" }))}
                  className="h-9 rounded-lg bg-slate-50/50"
                  includeTime
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Đến ngày
                </Label>
                <DatePicker
                  value={filters.to}
                  onChange={(v) => setFilters((f) => ({ ...f, to: v || "" }))}
                  className="h-9 rounded-lg bg-slate-50/50"
                  includeTime
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={resetFilters} className="rounded-lg">
                Xóa lọc
              </Button>
              <Button onClick={fetchData} className="rounded-lg bg-emerald-600 hover:bg-emerald-700">
                Áp dụng bộ lọc
              </Button>
            </div>
          </div>
        )}

        <AdminCard data-tour="audit-table" className="overflow-hidden">
          {loading ? (
            <AdminLoadingState className="flex-col gap-4 py-20">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
                Đang truy vấn nhật ký...
              </p>
            </AdminLoadingState>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
                  <TableRow className="hover:bg-transparent border-b-2 border-slate-200 dark:border-slate-700">
                    <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Người dùng
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Hành động
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Tài nguyên
                    </TableHead>
                    <TableHead className="px-4 py-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Kết quả
                    </TableHead>
                    <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Thời gian
                    </TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <tbody className="divide-y divide-slate-300/50 dark:divide-slate-700/50">
                  {!result?.data.length ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-20 text-slate-400 italic"
                      >
                        Không tìm thấy bản ghi nào
                      </td>
                    </tr>
                  ) : (
                    result.data.map((log) => (
                      <tr
                        key={log.id}
                        className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase shadow-xs">
                              {log.username.charAt(0)}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {log.username}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-slate-300" />
                            <code className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                              {log.action}
                            </code>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />{" "}
                              {log.resource}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono italic">
                              ID: {log.resource_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge allowed={log.allowed} />
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}

          <AdminTableFooter className="bg-slate-50/40 dark:bg-slate-800/20">
            <Pagination
              total={result?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </AdminTableFooter>
        </AdminCard>
      </div>

      {/* ─── Log Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-2xl p-0 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 gap-0">
          {/* ── Header ── */}
          <div
            className={cn(
              "relative px-6 py-5 flex items-center justify-between gap-4 overflow-hidden",
              selectedLog?.allowed
                ? "bg-gradient-to-r from-emerald-500/10 via-emerald-50/60 to-white dark:from-emerald-500/10 dark:via-emerald-950/40 dark:to-slate-950"
                : "bg-gradient-to-r from-red-500/10 via-red-50/60 to-white dark:from-red-500/10 dark:via-red-950/40 dark:to-slate-950",
            )}
          >
            {/* Decorative blur orb */}
            <div
              className={cn(
                "absolute -top-4 -left-4 w-24 h-24 rounded-full opacity-20 blur-2xl",
                selectedLog?.allowed ? "bg-emerald-500" : "bg-red-500",
              )}
            />

            <div className="relative flex items-center gap-4">
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shadow-md",
                  selectedLog?.allowed
                    ? "bg-emerald-500 text-white shadow-emerald-200 dark:shadow-emerald-900/50"
                    : "bg-red-500 text-white shadow-red-200 dark:shadow-red-900/50",
                )}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Chi tiết sự kiện hệ thống
                  </DialogTitle>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                      selectedLog?.allowed
                        ? "bg-emerald-500 text-white border-emerald-400"
                        : "bg-red-500 text-white border-red-400",
                    )}
                  >
                    {selectedLog?.allowed ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" /> Allowed
                      </>
                    ) : (
                      <>
                        <XCircle className="w-2.5 h-2.5" /> Denied
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(selectedLog?.created_at || "").toLocaleString(
                      "vi-VN",
                      { dateStyle: "full", timeStyle: "medium" },
                    )}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    #{selectedLog?.id}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <ScrollArea className="max-h-[calc(90vh-160px)]">
            <div className="p-6 space-y-5">
              {/* Info cards grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* User */}
                <div className="group flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all duration-200">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <User className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Người thực hiện
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                    {selectedLog?.username}
                  </p>
                </div>

                {/* Action */}
                <div className="group flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-violet-200 dark:hover:border-violet-800/60 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition-all duration-200">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <div className="w-5 h-5 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-violet-500 dark:text-violet-400" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Hành động
                    </span>
                  </div>
                  <code className="text-[11px] font-mono font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded w-fit">
                    {selectedLog?.action}
                  </code>
                </div>

                {/* Resource */}
                <div className="group flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-800/60 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all duration-200">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <div className="w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <Database className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Tài nguyên
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize truncate">
                    {selectedLog?.resource}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono -mt-1 truncate">
                    ID: {selectedLog?.resource_id || "—"}
                  </p>
                </div>

                {/* IP */}
                <div className="group flex flex-col gap-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-cyan-200 dark:hover:border-cyan-800/60 hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20 transition-all duration-200">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <div className="w-5 h-5 rounded-md bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                      <Globe className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      Địa chỉ IP
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {selectedLog?.ip_address}
                  </p>
                </div>
              </div>

              {/* Payload: Request & Response */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <JsonPreview
                  label="Request Payload"
                  icon={ExternalLink}
                  data={selectedLog?.request || ""}
                />
                <JsonPreview
                  label="Response Payload"
                  icon={Activity}
                  data={selectedLog?.response || ""}
                />
              </div>

              {/* User Agent */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    <Monitor className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Trình duyệt & Thiết bị
                  </span>
                </div>
                <div className="px-4 py-3 bg-white dark:bg-slate-950">
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all leading-relaxed">
                    {selectedLog?.user_agent || (
                      <span className="italic text-slate-300">
                        Không có thông tin
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              Log ID:{" "}
              <span className="font-bold text-slate-600 dark:text-slate-300">
                #{selectedLog?.id}
              </span>
            </p>
            <Button
              onClick={() => setSelectedLog(null)}
              className="h-9 px-6 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm"
            >
              Đóng lại
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
