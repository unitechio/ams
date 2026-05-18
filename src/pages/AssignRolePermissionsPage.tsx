import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Key, Search, ChevronRight, ChevronDown, Save, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { rolesApi, permissionsApi, type ApiRole, type ApiPermission } from '@/lib/api';
import { SCOPES } from '@/auth/permissions';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import { StepUpDialog } from '@/components/auth/StepUpDialog';
const SCOPE_OPTIONS = [
  { value: SCOPES.SELF, label: 'Self', color: 'emerald' },
  { value: SCOPES.DEPARTMENT, label: 'Dept', color: 'emerald' },
  { value: SCOPES.ORGANIZATION, label: 'Org', color: 'emerald' },
  { value: SCOPES.GLOBAL, label: 'Global', color: 'emerald' },
];

export default function AssignRolePermissionsPage() {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [perms, setPerms] = useState<ApiPermission[]>([]);
  const [selectedRoleID, setSelectedRoleID] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  // State for permissions of the selected role: map code -> scope
  const [selectedPerms, setSelectedPerms] = useState<Record<string, string>>({});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesApi.list({ page_size: 100 }),
        permissionsApi.list(),
      ]);
      setRoles(rolesRes.data);
      setPerms(permsRes);
    } catch {
      toast.error('Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRoleChange = async (id: string) => {
    setSelectedRoleID(id);
    const role = roles.find(r => r.id === Number(id));
    if (role) {
      const map: Record<string, string> = {};
      (role.permission_codes || []).forEach((code, i) => {
        map[code] = role.scopes?.[i] || SCOPES.SELF;
      });
      setSelectedPerms(map);
    }
  };

  const togglePerm = (code: string) => {
    setSelectedPerms(prev => {
      const next = { ...prev };
      if (code in next) delete next[code];
      else next[code] = SCOPES.SELF;
      return next;
    });
  };

  const setScope = (code: string, scope: string) => {
    setSelectedPerms(prev => ({ ...prev, [code]: scope }));
  };

  const handleSave = async () => {
    if (!selectedRoleID) return;
    setStepUpOpen(true);
  };

  // Group permissions
  const groups = perms.reduce<Record<string, ApiPermission[]>>((acc, p) => {
    const g = p.group_name || 'Khác';
    if (!acc[g]) acc[g] = [];
    if (!searchTerm ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      acc[g].push(p);
    }
    return acc;
  }, {});

  const selectedRole = roles.find(r => r.id === Number(selectedRoleID));

  return (
    <>
    <StepUpDialog
      open={stepUpOpen}
      onOpenChange={setStepUpOpen}
      onVerified={async () => {
        if (!selectedRoleID) return;
        setSaving(true);
        try {
          const payload = Object.entries(selectedPerms).map(([code, scope]) => ({ code, scope }));
          await rolesApi.assignPermissions(Number(selectedRoleID), payload);
          toast.success('Gán quyền thành công');
          fetchData();
        } catch {
          toast.error('Lỗi khi lưu phân quyền');
        } finally {
          setSaving(false);
        }
      }}
      description="Xác thực lại trước khi thay đổi quyền hạn của vai trò."
    />
    <div className="space-y-6">
      <PageHeader
        title="Phân quyền vai trò"
        subtitle="Thiết lập quyền hạn (Permissions) cho từng vai trò (Roles)"
        actions={
          <Button
            onClick={handleSave}
            disabled={saving}
            className="hidden sm:flex h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-100"
          >
            <Save className="w-4.5 h-4.5 mr-2" />
            Lưu thiết lập
          </Button>
        }
      />

      <div className="flex flex-col xl:flex-row gap-6">
        {/* LEFT SIDEBAR */}
        <div className="w-full xl:w-[320px] lg:w-[280px] shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                Chọn vai trò cần thiết lập
              </Label>

              <Select value={selectedRoleID} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-11 rounded-xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950">
                  <SelectValue placeholder="Chọn một vai trò..." />
                </SelectTrigger>

                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  {roles.map(r => (
                    <SelectItem
                      key={r.id}
                      value={String(r.id)}
                      className="py-2.5 dark:focus:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-medium dark:text-slate-200">
                          {r.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole && (
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800 space-y-4">
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">
                    Mô tả vai trò
                  </p>

                  <p className="text-xs text-emerald-900 dark:text-emerald-100 leading-relaxed">
                    {selectedRole.description || 'Không có mô tả'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">
                      Đang chọn
                    </p>

                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {Object.keys(selectedPerms).length}
                    </p>

                    <p className="text-[9px] text-slate-400 dark:text-slate-500">
                      Quyền hạn
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">
                      Nhân sự
                    </p>

                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {selectedRole.user_count}
                    </p>

                    <p className="text-[9px] text-slate-400 dark:text-slate-500">
                      Thành viên
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {!selectedRoleID ? (
            <div className="h-full min-h-[400px] bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                <Key className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Chưa chọn vai trò
              </h3>

              <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
                Vui lòng chọn một vai trò từ danh sách bên trái để bắt đầu thiết lập quyền hạn
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-220px)] min-h-[500px]">
              {/* HEADER */}
              <div className="p-4 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />

                  <Input
                    placeholder="Tìm nhanh quyền hạn..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 h-10 text-sm rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Đã chọn
                  </span>

                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                    Chưa chọn
                  </span>
                </div>
              </div>

              {/* PERMISSION LIST */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 bg-slate-50/40 dark:bg-slate-950/40">
                {Object.entries(groups).map(([group, items]) => {
                  if (items.length === 0) return null;

                  const isExpanded = expandedGroup === group;
                  const selectedInGroup = items.filter(
                    p => p.code in selectedPerms
                  ).length;

                  return (
                    <div
                      key={group}
                      className={`rounded-xl transition-all duration-200 ${isExpanded
                        ? 'bg-slate-50/50 dark:bg-slate-800/30'
                        : ''
                        }`}
                    >
                      <button
                        onClick={() =>
                          setExpandedGroup(isExpanded ? null : group)
                        }
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/50 ${isExpanded
                          ? 'bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700'
                          : ''
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isExpanded
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                              }`}
                          >
                            <Shield className="w-4 h-4" />
                          </div>

                          <div className="text-left min-w-0">
                            <p
                              className={`text-sm font-bold uppercase tracking-tight truncate ${isExpanded
                                ? 'text-slate-900 dark:text-slate-100'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                              {group}
                            </p>

                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              {items.length} quyền khả dụng{' '}
                              {selectedInGroup > 0 &&
                                `• Đã chọn ${selectedInGroup}`}
                            </p>
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 grid grid-cols-1 2xl:grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                          {items.map(p => {
                            const isChecked = p.code in selectedPerms;
                            const currentScope = selectedPerms[p.code];

                            return (
                              <div
                                key={p.code}
                                className={`group flex flex-col p-3 rounded-xl border transition-all duration-200 ${isChecked
                                  ? 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800/50 shadow-sm'
                                  : 'bg-transparent border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-100 dark:hover:border-slate-700'
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div
                                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                                    onClick={() => togglePerm(p.code)}
                                  >
                                    <div
                                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isChecked
                                        ? 'bg-emerald-600 border-emerald-600'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                      {isChecked && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      <p
                                        className={`text-sm font-semibold truncate ${isChecked
                                          ? 'text-slate-900 dark:text-slate-100'
                                          : 'text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400'
                                          }`}
                                      >
                                        {p.code}
                                      </p>

                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-medium">
                                        {p.name || 'N/A'}
                                      </p>
                                    </div>
                                  </div>

                                  {isChecked && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] py-0 border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50"
                                    >
                                      ACTIVE
                                    </Badge>
                                  )}
                                </div>

                                {isChecked && (
                                  <div className="flex items-start gap-1.5 pt-2 border-t border-slate-50 dark:border-slate-700 mt-1">
                                    <Info className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0 mt-1" />

                                    <div className="flex-1 flex flex-wrap gap-1">
                                      {SCOPE_OPTIONS.map(opt => (
                                        <button
                                          key={opt.value}
                                          onClick={() =>
                                            setScope(p.code, opt.value)
                                          }
                                          className={`text-[9px] px-2 py-1 rounded-md font-bold transition-all whitespace-nowrap ${currentScope === opt.value
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                                            }`}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* MOBILE/TABLET SAVE */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 sm:hidden">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 dark:shadow-none transition-all font-bold"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}

                  LƯU THIẾT LẬP
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// Tailored Label component
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-slate-700 dark:text-slate-300 ${className}`}>{children}</label>;
}
