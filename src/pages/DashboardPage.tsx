import React, { useState, useEffect } from 'react';
import { Users, Shield, Key, Menu as MenuIcon, TrendingUp, Activity, Clock, ArrowUpRight } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { usersApi, rolesApi, permissionsApi, menusApi, dashboardApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/auth/usePermission';
import { PERMISSIONS, PERMISSION_LABELS } from '@/auth/permissions';
import { Guard } from '@/guards/Guard';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

interface Stats {
  users: number;
  roles: number;
  permissions: number;
  menus: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { can, isSuperAdmin } = usePermission();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ users: 0, roles: 0, permissions: 0, menus: 0 });
  const [chartData, setChartData] = useState<{
    user_status_distribution: any[];
    login_activity_7d: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled([
        can(PERMISSIONS.USER_READ) ? usersApi.list({ page_size: 1 }) : Promise.resolve(null),
        can(PERMISSIONS.ROLE_READ) ? rolesApi.list({ page_size: 1 }) : Promise.resolve(null),
        can(PERMISSIONS.PERMISSION_READ) ? permissionsApi.list() : Promise.resolve(null),
        can(PERMISSIONS.MENU_READ) ? menusApi.list({ page_size: 1 }) : Promise.resolve(null),
        dashboardApi.getStats().catch(() => ({ user_status_distribution: [], login_activity_7d: [] })),
      ]);
      setStats({
        users: results[0].status === 'fulfilled' && results[0].value ? (results[0].value as any).total ?? 0 : 0,
        roles: results[1].status === 'fulfilled' && results[1].value ? (results[1].value as any).total ?? 0 : 0,
        permissions: results[2].status === 'fulfilled' && results[2].value ? (results[2].value as any[]).length ?? 0 : 0,
        menus: results[3].status === 'fulfilled' && results[3].value ? (results[3].value as any).total ?? 0 : 0,
      });
      if (results[4].status === 'fulfilled' && results[4].value) {
        setChartData(results[4].value as any);
      }
      setLoading(false);
    };
    load();
  }, [can]);

  const STATUS_COLORS: Record<string, string> = {
    active: '#10b981', // emerald-500
    inactive: '#94a3b8', // slate-400
    locked: '#f43f5e', // rose-500
  };

  const statCards = [
    { label: 'Người dùng', value: stats.users, icon: Users, color: 'from-emerald-500 to-teal-600', href: '/users', perm: PERMISSIONS.USER_READ },
    { label: 'Vai trò', value: stats.roles, icon: Shield, color: 'from-blue-500 to-cyan-600', href: '/roles', perm: PERMISSIONS.ROLE_READ },
    { label: 'Quyền hạn', value: stats.permissions, icon: Key, color: 'from-violet-500 to-purple-600', href: '/permissions', perm: PERMISSIONS.PERMISSION_READ },
    { label: 'Menu hệ thống', value: stats.menus, icon: MenuIcon, color: 'from-amber-500 to-orange-600', href: '/menus', perm: PERMISSIONS.MENU_READ },
  ];

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Chào buổi sáng' : now.getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan hệ thống"
        subtitle="Bảng điều khiển trung tâm và giám sát hạ tầng định danh"
      />

      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 mb-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-4 -right-4 w-40 h-40 rounded-full border-4 border-white" />
          <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full border-4 border-white" />
        </div>
        <div className="relative">
          <p className="text-emerald-100 text-sm mb-1">{greeting} 👋</p>
          <h2 className="text-2xl font-bold text-white mb-1">{user?.full_name}</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {user?.roles?.map(r => (
              <span key={r} className="text-xs px-2.5 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium">
                {r}
              </span>
            ))}
            {isSuperAdmin() && (
              <span className="text-xs px-2.5 py-1 bg-yellow-400/30 text-yellow-100 rounded-full font-medium flex items-center gap-1">
                ⭐ Super Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon, color, href, perm }) => (
          <Guard key={label} permission={perm} fallback={
            <div className="bg-white rounded-xl border border-gray-100 p-5 opacity-40">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-3xl font-bold text-gray-300 mt-1">—</p>
            </div>
          }>
            <button
              onClick={() => navigate(href)}
              className="bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-md hover:border-gray-200 transition-all group w-full"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {loading ? <span className="text-gray-200">...</span> : value}
              </p>
            </button>
          </Guard>
        ))}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Donut Chart: User Status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Phân bổ người dùng</h3>
              <p className="text-xs text-gray-400">Theo trạng thái hoạt động</p>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartData?.user_status_distribution && chartData.user_status_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.user_status_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {chartData.user_status_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status.toLowerCase()] || '#cbd5e1'} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string, props: any) => [value, props.payload.status === 'active' ? 'Hoạt động' : props.payload.status === 'inactive' ? 'Tạm khóa' : props.payload.status === 'locked' ? 'Khóa' : props.payload.status]}
                  />
                  <Legend 
                    formatter={(value, entry: any) => {
                      const status = entry.payload.status;
                      return status === 'active' ? 'Hoạt động' : status === 'inactive' ? 'Tạm khóa' : status === 'locked' ? 'Khóa' : status;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        {/* Line Chart: Login Activity */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Hoạt động đăng nhập</h3>
              <p className="text-xs text-gray-400">Thống kê 7 ngày gần nhất</p>
            </div>
          </div>
          <div className="h-64 w-full">
            {chartData?.login_activity_7d && chartData.login_activity_7d.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.login_activity_7d} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    name="Thành công"
                    dataKey="success" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    type="monotone" 
                    name="Thất bại"
                    dataKey="failed" 
                    stroke="#f43f5e" 
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">Chưa có dữ liệu</div>
            )}
          </div>
        </div>
      </div>

      {/* Permission Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Your Permissions */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <Key className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Quyền hạn của bạn</p>
              <p className="text-xs text-gray-400">{user?.permissions?.length ?? 0} quyền đang hoạt động</p>
            </div>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            {isSuperAdmin() ? (
              <div className="flex items-center gap-3 bg-yellow-50 rounded-lg p-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <p className="font-semibold text-yellow-800 text-sm">Wildcard Permission</p>
                  <p className="text-xs text-yellow-600">Bạn có toàn quyền trên hệ thống</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {(user?.permissions || []).map(pStr => {
                  const [code, scope] = pStr.split(':');
                  return (
                    <div key={pStr} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-gray-50">
                      <div>
                        <code className="font-mono text-emerald-700">{code}</code>
                        <p className="text-gray-400 text-[10px]">{PERMISSION_LABELS[code] || code}</p>
                      </div>
                      {scope && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${scope === 'global' ? 'bg-emerald-50 text-emerald-600' :
                          scope === 'organization' ? 'bg-violet-50 text-violet-600' :
                            scope === 'department' ? 'bg-blue-50 text-blue-600' :
                              'bg-gray-100 text-gray-500'
                          }`}>{scope}</span>
                      )}
                    </div>
                  );
                })}
                {!user?.permissions?.length && (
                  <p className="text-center text-gray-400 text-xs py-4">Chưa có quyền nào được gán</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Truy cập nhanh</p>
              <p className="text-xs text-gray-400">Các chức năng thường dùng</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Thêm người dùng', href: '/users', perm: PERMISSIONS.USER_CREATE, color: 'hover:bg-emerald-50 hover:border-emerald-200', icon: Users },
              { label: 'Tạo vai trò', href: '/roles', perm: PERMISSIONS.ROLE_CREATE, color: 'hover:bg-blue-50 hover:border-blue-200', icon: Shield },
              { label: 'Gán quyền', href: '/roles', perm: PERMISSIONS.ROLE_ASSIGN, color: 'hover:bg-violet-50 hover:border-violet-200', icon: Key },
              { label: 'Quản lý menu', href: '/menus', perm: PERMISSIONS.MENU_READ, color: 'hover:bg-amber-50 hover:border-amber-200', icon: MenuIcon },
            ].map(({ label, href, perm, color, icon: Icon }) => (
              <Guard key={label} permission={perm}>
                <button
                  onClick={() => navigate(href)}
                  className={`text-left p-3 rounded-xl border border-gray-100 transition-all ${color} group`}
                >
                  <Icon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mb-1.5" />
                  <p className="text-xs font-medium text-gray-700">{label}</p>
                </button>
              </Guard>
            ))}
          </div>

          {/* System Info */}
          <div className="p-4 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Thông tin phiên</p>
            {[
              { label: 'Tài khoản', value: user?.username },
              { label: 'Email', value: user?.email },
              { label: 'Trạng thái', value: user?.status },
              { label: 'Thời gian', value: now.toLocaleTimeString('vi-VN') },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-xs py-1">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
