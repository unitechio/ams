import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Key, Mail, Phone, ShieldCheck, ShieldAlert, Save, Lock, Unlock, Loader2, Plus, RefreshCcw, AlertCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AdminCard, AdminLoadingState, AdminSearchField, AdminTableFooter, AdminToolbar } from '@/components/layout/AdminShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
  DialogHeader, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { usersApi, rolesApi, type ApiUser, type ApiRole, type PaginatedResponse } from '@/lib/api';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateRandomPassword, getPasswordPolicyHint } from '@/lib/password';
import { StepUpDialog } from '@/components/auth/StepUpDialog';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: 'Hoạt động', cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50' },
  inactive: { label: 'Vô hiệu', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700' },
  locked: { label: 'Bị khóa', cls: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/50' },
};

const AVATAR_COLORS = [
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-indigo-500',
  'from-violet-400 to-purple-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
];

function Avatar({ name, id }: { name: string; id: number }) {
  const letter = name?.charAt(0)?.toUpperCase() ?? '?';
  const color = AVATAR_COLORS[id % AVATAR_COLORS.length];
  return (
    <div className={cn(
      'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0',
      color
    )}>
      {letter}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none mt-0.5 font-outfit">{value}</p>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResponse<ApiUser> | null>(null);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ApiUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetOneTimePassword, setResetOneTimePassword] = useState(true);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<null | (() => Promise<void>)>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [usersRes, rolesRes] = await Promise.all([
        usersApi.list({ search, page, page_size: pageSize }),
        rolesApi.list({ page_size: 100 }),
      ]);
      setResult(usersRes);
      setRoles(rolesRes.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Lỗi tải dữ liệu';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setStepUpAction(() => async () => {
      setSaving(true);
      try {
        await usersApi.delete(deleteTarget.id);
        toast.success(`Đã xóa ${deleteTarget.full_name}`);
        setDeleteOpen(false); setDeleteTarget(null); fetchData();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Lỗi xóa người dùng');
      } finally { setSaving(false); }
    });
    setStepUpOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword) return;
    setStepUpAction(() => async () => {
      setSaving(true);
      try {
        await usersApi.resetPassword(resetTarget.id, newPassword, resetOneTimePassword);
        toast.success('Đặt lại mật khẩu thành công');
        setResetOpen(false); setResetTarget(null); setNewPassword(''); setResetOneTimePassword(true);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Lỗi đặt lại mật khẩu');
      } finally { setSaving(false); }
    });
    setStepUpOpen(true);
  };

  const handleToggleStatus = async (u: ApiUser) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    setPendingIds(prev => [...prev, u.id]);
    try {
      await usersApi.update(u.id, { status: next });
      toast.success(`Đã ${next === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} ${u.full_name}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi thay đổi trạng thái');
    } finally {
      setPendingIds(prev => prev.filter(id => id !== u.id));
    }
  };

  const users = result?.data ?? [];

  return (
    <>
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        onVerified={async () => {
          if (stepUpAction) await stepUpAction();
          setStepUpAction(null);
        }}
        description="Xác thực lại để xóa người dùng hoặc đặt lại mật khẩu."
      />
      <div className="space-y-6">
        <PageHeader
          title="Quản lý người dùng"
          subtitle="Danh sách tài khoản và phân quyền hệ thống"
          actions={
            <Guard permission={PERMISSIONS.USER_CREATE}>
              <Button
                onClick={() => navigate('/users/create')}
                data-tour="users-create-button"
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-100"
              >
                <Plus className="w-4.5 h-4.5 mr-2" /> Thêm người dùng
              </Button>
            </Guard>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Tổng" value={result?.total ?? 0} icon={Users} color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Hoạt động" value={users.filter(u => u.status === 'active').length} icon={Unlock} color="bg-blue-50 text-blue-600" />
          <StatCard label="Vô hiệu" value={users.filter(u => u.status === 'inactive').length} icon={Lock} color="bg-slate-100 text-slate-500" />
          <StatCard label="Bị khóa" value={users.filter(u => u.status === 'locked').length} icon={Lock} color="bg-red-50 text-red-500" />
        </div>

        {/* Table card */}
        <AdminCard className="overflow-hidden">

          {/* Toolbar */}
          <AdminToolbar>
            <AdminSearchField className="max-w-sm">
              <Input
                placeholder="Tìm theo tên, email, username..."
                value={search}
                autoComplete="off"
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-sm"
              />
            </AdminSearchField>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button variant="ghost" size="icon" onClick={fetchData}
                className="h-9 w-9 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
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
              <p className="text-sm text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</p>
            </AdminLoadingState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 h-11">
                    <th className="w-12 px-4 py-3 align-middle text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      #
                    </th>

                    <th className="w-[24%] px-4 py-3 align-middle text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Người dùng
                    </th>

                    <th className="hidden md:table-cell w-[28%] px-4 py-3 align-middle text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Liên hệ
                    </th>

                    <th className="hidden lg:table-cell w-[20%] px-4 py-3 align-middle text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Vai trò
                    </th>

                    <th className="w-[11%] px-4 py-3 align-middle text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Bảo mật
                    </th>

                    <th className="w-[9%] px-4 py-3 align-middle text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Trạng thái
                    </th>

                    <th className="w-[8%] px-4 py-3 align-middle text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Thao tác
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!users.length ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-16 text-slate-400 text-sm italic"
                      >
                        Không tìm thấy người dùng nào
                      </td>
                    </tr>
                  ) : (
                    users.map((u, idx) => (
                      <tr
                        key={u.id}
                        className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors h-14"
                      >
                        {/* Index */}
                        <td className="px-4 py-3 align-middle text-[11px] text-slate-400 font-mono text-center">
                          {(page - 1) * pageSize + idx + 1}
                        </td>

                        {/* User */}
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={u.full_name} id={u.id} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {u.full_name}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono truncate">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="hidden md:table-cell px-4 py-3 align-middle">
                          <div className="space-y-1 leading-tight">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </div>

                            {u.phone && (
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                <span>{u.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Roles */}
                        <td className="hidden lg:table-cell px-4 py-3 align-middle">
                          <div className="flex flex-wrap gap-1 items-center">
                            {!u.roles?.length ? (
                              <span className="text-[11px] text-slate-300">—</span>
                            ) : (
                              u.roles.map((r) => (
                                <Badge
                                  key={r}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0.5 rounded-md leading-none"
                                >
                                  {r}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Security */}
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-center gap-1 min-h-[28px]">
                            {u.two_factor_enabled && (
                              <span className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                              </span>
                            )}

                            {u.one_time_password && (
                              <span className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                            )}

                            {!u.two_factor_enabled && !u.one_time_password && (
                              <span className="text-[11px] text-slate-200">—</span>
                            )}
                          </div>
                        </td>

                        {/* Status + Actions */}
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-end gap-3">
                            {/* Status */}
                            <div className="min-w-[90px] flex justify-end">
                              {pendingIds.includes(u.id) ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                              ) : (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center min-w-[72px]",
                                    "text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide",
                                    STATUS_MAP[u.status]?.cls ??
                                    "bg-slate-100 text-slate-500"
                                  )}
                                >
                                  {STATUS_MAP[u.status]?.label ?? u.status}
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Guard permission={PERMISSIONS.USER_UPDATE}>
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={pendingIds.includes(u.id)}
                                  className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center",
                                    u.status === "active"
                                      ? "text-amber-500 hover:bg-amber-50"
                                      : "text-emerald-500 hover:bg-emerald-50"
                                  )}
                                  title={
                                    u.status === "active"
                                      ? "Vô hiệu hóa"
                                      : "Kích hoạt"
                                  }
                                >
                                  {u.status === "active" ? (
                                    <Lock className="w-3.5 h-3.5" />
                                  ) : (
                                    <Unlock className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  onClick={() => {
                                    setResetTarget(u);
                                    setResetOpen(true);
                                  }}
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-violet-500 hover:bg-violet-50"
                                  title="Đặt lại mật khẩu"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => navigate(`/users/${u.id}/edit`)}
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-blue-500 hover:bg-blue-50"
                                  title="Chỉnh sửa"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </Guard>

                              <Guard permission={PERMISSIONS.USER_DELETE}>
                                <button
                                  onClick={() => {
                                    setDeleteTarget(u);
                                    setDeleteOpen(true);
                                  }}
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-red-400 hover:bg-red-50"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </Guard>
                            </div>
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

      {/* ─── Reset Password Dialog ───────────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={v => { setResetOpen(v); if (!v) { setNewPassword(''); setResetOneTimePassword(true); } }}>
        <DialogContent className="p-0 border-0 shadow-2xl overflow-hidden max-w-md bg-white dark:bg-slate-900">
          <div className="bg-violet-600 px-6 py-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-semibold">Đặt lại mật khẩu</DialogTitle>
                <DialogDescription className="text-violet-100/80 text-xs mt-0.5">
                  Tài khoản: <code className="font-mono bg-white/20 px-1.5 rounded text-white">@{resetTarget?.username}</code>
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mật khẩu mới</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  type="password"
                  placeholder="Tối thiểu 8 ký tự..."
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                  className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50/50 text-sm focus-visible:ring-violet-500"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">{getPasswordPolicyHint()}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setNewPassword(generateRandomPassword())} className="h-8 rounded-lg whitespace-nowrap">
                  Random pass
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetOneTimePassword}
                  onChange={(e) => setResetOneTimePassword(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-[12px] font-semibold text-slate-700">Mật khẩu một lần</p>
                  <p className="text-[11px] text-slate-500">Buộc người dùng đổi mật khẩu ngay ở lần đăng nhập tiếp theo.</p>
                </div>
              </label>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Hành động này sẽ vô hiệu hóa mật khẩu cũ ngay lập tức và đăng xuất khỏi tất cả thiết bị.
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Hủy</Button>
            <Button
              onClick={handleResetPassword}
              disabled={saving || newPassword.length < 8}
              className="h-9 px-5 rounded-lg bg-violet-600 hover:bg-violet-700 font-medium text-white shadow-sm shadow-violet-200 dark:shadow-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              Xác nhận
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
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Xác nhận xóa tài khoản?</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Bạn đang xóa <span className="font-semibold text-slate-700 dark:text-slate-300">{deleteTarget?.full_name}</span>.
                Hành động này không thể hoàn tác.
              </DialogDescription>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}
              className="h-9 px-4 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Hủy</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="h-9 px-5 rounded-lg font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
