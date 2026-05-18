import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Users,
  Key,
  Loader2,
  AlertCircle,
  RefreshCcw,
  ExternalLink,
  Save,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter, AdminToolbar } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { rolesApi, type ApiRole, type PaginatedResponse } from "@/lib/api";
import { Guard } from "@/guards/Guard";
import { PERMISSIONS } from "@/auth/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center gap-3">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          color,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none mt-0.5 font-outfit">
          {value}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function RolesPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<ApiRole> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ApiRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRole | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", description: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await rolesApi.list({ search, page, page_size: pageSize });
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi tải dữ liệu";
      setError(msg);
      toast.error("Không thể tải danh sách vai trò");
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingRole(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (r: ApiRole) => {
    setEditingRole(r);
    setForm({ name: r.name, description: r.description || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.warning("Vui lòng nhập tên vai trò");
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await rolesApi.update(editingRole.id, form);
        toast.success("Cập nhật vai trò thành công");
      } else {
        await rolesApi.create(form);
        toast.success("Thêm vai trò mới thành công");
      }
      setDialogOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi khi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await rolesApi.delete(deleteTarget.id);
      toast.success(`Đã xóa vai trò ${deleteTarget.name}`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi khi xóa vai trò");
    } finally {
      setSaving(false);
    }
  };

  const totalUsers =
    result?.data.reduce((acc, r) => acc + Number(r.user_count || 0), 0) ?? 0;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Quản lý Vai trò"
          subtitle="Định nghĩa các nhóm quyền hạn để gán cho người dùng hệ thống"
          actions={
            <Guard permission={PERMISSIONS.ROLE_CREATE}>
              <Button
                onClick={openCreate}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-100"
              >
                <Plus className="w-4.5 h-4.5 mr-2" /> Thêm vai trò mới
              </Button>
            </Guard>
          }
        />

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Tổng vai trò"
            value={result?.total ?? 0}
            icon={Shield}
            color="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Thành viên gán"
            value={totalUsers}
            icon={Users}
            color="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
          />

          <div
            className="bg-emerald-600 dark:bg-emerald-700 rounded-xl p-4 shadow-sm shadow-emerald-100 dark:shadow-none flex items-center justify-between group cursor-pointer hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
            onClick={() => navigate("/roles/assign")}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">
                  Thiết lập quyền
                </p>
                <p className="text-sm font-bold text-white font-outfit">
                  Gán quyền cho Role
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
          </div>
        </div>

        {/* Table card */}
        <AdminCard className="overflow-hidden">
          {/* Toolbar */}
          <AdminToolbar>
            <AdminSearchField className="max-w-sm">
              <Input
                placeholder="Tìm theo tên hoặc mô tả..."
                value={search}
                autoComplete="off"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm"
              />
            </AdminSearchField>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchData}
                className="h-9 w-9 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          </AdminToolbar>

          {/* Content */}
          {error ? (
            <div className="flex flex-col items-center gap-3 py-20 text-red-500">
              <AlertCircle className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                className="rounded-lg"
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Thử lại
              </Button>
            </div>
          ) : loading ? (
            <AdminLoadingState className="flex-col gap-3 py-20">
              <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-400 font-medium">
                Đang tải danh sách...
              </p>
            </AdminLoadingState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="w-10 px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      #
                    </th>
                    <th className="w-[24%] px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Vai trò
                    </th>
                    <th className="hidden md:table-cell w-[40%] px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Mô tả
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28 whitespace-nowrap">
                      Thành viên
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-28 whitespace-nowrap">
                      Quyền hạn
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-32 whitespace-nowrap">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!result?.data.length ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-16 text-slate-400 text-sm italic"
                      >
                        Không tìm thấy vai trò nào
                      </td>
                    </tr>
                  ) : (
                    result.data.map((r, idx) => (
                      <tr
                        key={r.id}
                        className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-[11px] text-slate-300 dark:text-slate-600 font-mono">
                          {(page - 1) * pageSize + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                              {r.name}
                            </p>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500 dark:text-slate-400 italic max-w-xs truncate">
                          {r.description || "Chưa có mô tả"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0 font-semibold px-2 py-0.5 rounded-md text-[10px]"
                          >
                            <Users className="w-3 h-3 mr-1" /> {r.user_count}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="secondary"
                            className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0 font-semibold px-2 py-0.5 rounded-md text-[10px]"
                          >
                            <Key className="w-3 h-3 mr-1" />{" "}
                            {r.permission_codes?.length ?? 0}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Guard permission={PERMISSIONS.ROLE_UPDATE}>
                              <button
                                onClick={() => openEdit(r)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                title="Sửa"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => navigate("/roles/assign")}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                title="Gán quyền"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                            </Guard>
                            <Guard permission={PERMISSIONS.ROLE_DELETE}>
                              <button
                                onClick={() => {
                                  setDeleteTarget(r);
                                  setDeleteOpen(true);
                                }}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </Guard>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
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

      {/* ─── Create / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-md bg-white dark:bg-slate-900">
          <div className="bg-emerald-600 px-6 py-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-semibold">
                  {editingRole ? "Chỉnh sửa vai trò" : "Tạo vai trò mới"}
                </DialogTitle>
                <DialogDescription className="text-emerald-100/80 text-xs mt-0.5">
                  Định nghĩa định danh và mô tả chức năng nhóm quyền
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <Field label="Tên vai trò" required>
              <Input
                placeholder="Ví dụ: QUAN_LY_NHAN_SU"
                value={form.name}
                autoComplete="off"
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))
                }
                className="h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm focus-visible:ring-emerald-500 font-mono uppercase"
              />
            </Field>
            <Field label="Mô tả chi tiết">
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                placeholder="Mô tả chức năng của vai trò này..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </Field>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4 mr-1.5" /> Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-medium text-white shadow-sm shadow-emerald-200 dark:shadow-none"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {editingRole ? "Lưu thay đổi" : "Tạo vai trò"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-sm bg-white dark:bg-slate-900">
          <div className="px-6 pt-6 pb-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Xác nhận xóa vai trò?
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Bạn đang xóa{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {deleteTarget?.name}
                </span>
                . Hành động này sẽ ảnh hưởng tới các thành viên thuộc nhóm này.
              </DialogDescription>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="h-9 px-5 rounded-lg font-medium shadow-sm shadow-red-100 dark:shadow-none"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
