import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Shield, Save, Loader2, UserCheck, ShieldCheck, RefreshCcw, Plus } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usersApi, rolesApi, type ApiUser, type ApiRole } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Guard } from '@/guards/Guard';
import { PERMISSIONS } from '@/auth/permissions';
import { useNavigate } from 'react-router-dom';

export default function UserRolesPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedRoleIDs, setSelectedRoleIDs] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rolesRes = await rolesApi.list({ page_size: 100 });
      setRoles(rolesRes.data);
    } catch {
      toast.error('Lỗi tải danh sách vai trò');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Search users on typing
  useEffect(() => {
    if (userSearch.length < 2) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await usersApi.list({ search: userSearch, page_size: 10 });
        setUsers(res.data);
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleSelectUser = (u: ApiUser) => {
    setSelectedUser(u);
    setSelectedRoleIDs(u.role_ids || []);
    setUserSearch(`${u.id} - ${u.full_name}`);
    setShowUserDropdown(false);
  };

  const toggleRole = (id: number) => {
    setSelectedRoleIDs(prev =>
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };
  const paginatedRoles = roles.slice((page - 1) * pageSize, page * pageSize);

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, { role_ids: selectedRoleIDs });
      toast.success(`Đã cập nhật vai trò cho người dùng ${selectedUser.full_name}`);
      // Refresh user info
      const fresh = await usersApi.get(selectedUser.id);
      setSelectedUser(fresh);
    } catch {
      toast.error('Lỗi khi lưu vai trò');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cấp vai trò thành viên"
        subtitle="Gán quyền hạn (Roles) cho từng nhân viên/người dùng cụ thể"
        actions={
          <Guard permission={PERMISSIONS.ROLE_CREATE}>
            <Button
              onClick={() => navigate('/role')}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-100"
            >
              <Plus className="w-4.5 h-4.5 mr-2" /> Thêm vai trò
            </Button>
          </Guard>
        }
      />
      <div className="space-y-6">
        <div className="max-w-md space-y-4">
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-bold uppercase text-gray-400">Chọn nhân viên / người dùng</Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm nhân viên qua mã hoặc tên..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                onFocus={() => setShowUserDropdown(true)}
                className="h-11 rounded-xl border-gray-100 bg-gray-50/50 pl-10 transition-all focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
              />

              {showUserDropdown && users.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-200 dark:border-slate-800 dark:bg-slate-900">
                  <div className="max-h-60 overflow-y-auto">
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="flex w-full items-center gap-3 border-b border-gray-50 p-3 text-left transition-colors hover:bg-emerald-50 last:border-0 dark:border-slate-800 dark:hover:bg-emerald-950/20"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{u.id} - {u.full_name}</p>
                          <p className="font-mono text-[10px] text-gray-400 dark:text-slate-500">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedUser && (
            <div className="flex items-center gap-4 rounded-xl border border-emerald-100/50 bg-emerald-50/30 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-tight text-emerald-900 dark:text-emerald-100">{selectedUser.full_name}</p>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300">{selectedUser.email} • {selectedUser.status}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Roles List */}
      {selectedUser ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-gray-50 bg-gray-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-slate-100">
              <Shield className="w-4 h-4 text-emerald-600" /> DANH SÁCH VAI TRÒ HỆ THỐNG
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white text-[10px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Đã chọn: {selectedRoleIDs.length}</Badge>
              <Button onClick={handleSave} disabled={saving} size="sm" className="h-8 rounded-lg bg-emerald-600 shadow-md shadow-emerald-50 hover:bg-emerald-700 dark:shadow-none">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                LƯU THIẾT LẬP
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader className="bg-gray-50/30 dark:bg-slate-950/40">
              <TableRow>
                <TableHead className="w-12 text-center text-[10px] font-black">#</TableHead>
                <TableHead className="w-16 text-center text-[10px] font-black uppercase">Gán</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Tên vai trò</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Mô tả chi tiết</TableHead>
                <TableHead className="w-32 text-center text-[10px] font-black uppercase">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRoles.map((r, idx) => {
                const isChecked = selectedRoleIDs.includes(r.id);
                return (
                  <TableRow key={r.id} className={`group transition-colors ${isChecked ? 'bg-emerald-50/30' : 'hover:bg-gray-50/50'}`}>
                    <TableCell className="text-center font-mono text-xs text-gray-400 dark:text-slate-500">{(page - 1) * pageSize + idx + 1}</TableCell>
                    <TableCell className="text-center">
                      <div
                        onClick={() => toggleRole(r.id)}
                          className={`mx-auto flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${isChecked ? 'border-emerald-600 bg-emerald-600 shadow-sm' : 'border-gray-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-950'}`}
                      >
                        {isChecked && <ShieldCheck className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className={`text-sm font-bold ${isChecked ? 'text-emerald-900 dark:text-emerald-200' : 'text-gray-900 dark:text-slate-100'}`}>{r.name}</p>
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-1 text-xs text-gray-500 dark:text-slate-400">{r.description || 'Chưa có mô tả chi tiết cho vai trò này'}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="border-emerald-100 bg-emerald-100/50 px-2 py-0 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">Khả dụng</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="border-t border-gray-50 bg-gray-50/20 p-3 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="mb-2 flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500">
              <RefreshCcw className="w-3 h-3" /> Hiển thị {(page - 1) * pageSize + 1} tới {Math.min(page * pageSize, roles.length)} của {roles.length} dữ liệu
            </div>
            <Pagination total={roles.length} page={page} pageSize={pageSize} onPageChange={setPage} />
          </div>
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Users className="mb-4 h-10 w-10 text-gray-200 dark:text-slate-700" />
          <h4 className="max-w-xs text-sm text-gray-400 dark:text-slate-500">Vui lòng chọn người dùng để thiết lập vai trò</h4>
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-gray-700 dark:text-slate-300 ${className}`}>{children}</label>;
}
