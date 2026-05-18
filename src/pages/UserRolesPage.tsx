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
                className="pl-10 h-11 rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all"
              />

              {showUserDropdown && users.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="max-h-60 overflow-y-auto">
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-emerald-50 transition-colors text-left border-b border-gray-50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{u.id} - {u.full_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedUser && (
            <div className="flex items-center gap-4 p-4 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-emerald-900 uppercase tracking-tight">{selectedUser.full_name}</p>
                <p className="text-[11px] text-emerald-600 font-medium">{selectedUser.email} • {selectedUser.status}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Roles List */}
      {selectedUser ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" /> DANH SÁCH VAI TRÒ HỆ THỐNG
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white text-[10px] font-bold">Đã chọn: {selectedRoleIDs.length}</Badge>
              <Button onClick={handleSave} disabled={saving} size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 rounded-lg shadow-md shadow-emerald-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                LƯU THIẾT LẬP
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader className="bg-gray-50/30">
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
                    <TableCell className="text-center text-xs text-gray-400 font-mono">{(page - 1) * pageSize + idx + 1}</TableCell>
                    <TableCell className="text-center">
                      <div
                        onClick={() => toggleRole(r.id)}
                        className={`w-5 h-5 mx-auto rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${isChecked ? 'bg-emerald-600 border-emerald-600 shadow-sm' : 'border-gray-200 bg-white hover:border-emerald-300'}`}
                      >
                        {isChecked && <ShieldCheck className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className={`text-sm font-bold ${isChecked ? 'text-emerald-900' : 'text-gray-900'}`}>{r.name}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-gray-500 line-clamp-1">{r.description || 'Chưa có mô tả chi tiết cho vai trò này'}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px] font-bold bg-emerald-100/50 text-emerald-700 border-emerald-100 px-2 py-0">Khả dụng</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="border-t border-gray-50 bg-gray-50/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] text-gray-400">
              <RefreshCcw className="w-3 h-3" /> Hiển thị {(page - 1) * pageSize + 1} tới {Math.min(page * pageSize, roles.length)} của {roles.length} dữ liệu
            </div>
            <Pagination total={roles.length} page={page} pageSize={pageSize} onPageChange={setPage} />
          </div>
        </div>
      ) : (
        <div className="h-64 bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mb-4" />
          <h4 className="text-sm text-gray-400 max-w-xs">Vui lòng chọn người dùng để thiết lập vai trò</h4>
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-gray-700 ${className}`}>{children}</label>;
}
