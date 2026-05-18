import React, { useState } from 'react';
import { BookOpenText, Boxes, Compass, Database, ExternalLink, GitBranch, PlayCircle, Rocket, ScrollText, ServerCog, Shield, Sparkles, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { driver } from 'driver.js';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminCard } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { startWorkflowTour, workflowTours } from '@/lib/workflowTours';

type DocLink = { label: string; path: string; note: string };

const quickLinks: DocLink[] = [
  { label: 'Quản lý người dùng', path: '/users', note: 'Vòng đời user, reset password, trạng thái, allowed clients/channels.' },
  { label: 'OAuth Clients', path: '/auth-clients', note: 'Client app, audience, channel, redirect URI, secret rotation.' },
  { label: 'Service Accounts', path: '/service-accounts', note: 'Machine-to-machine clients cho internal service và cronjob.' },
  { label: 'Login Channels', path: '/login-channels', note: 'Risk boundary theo web/mobile/crm/kiosk/partner/service.' },
  { label: 'Security Policies', path: '/security-policies', note: 'Policy runtime cho auth, password, session, rate limit, step-up.' },
  { label: 'SSO Providers', path: '/sso-providers', note: 'OIDC/OAuth2/SAML provider registry và callback config.' },
  { label: 'Audit Logs', path: '/logs/audit', note: 'Theo dõi thay đổi và truy vết hành động trong toàn hệ thống.' },
  { label: 'Thiết bị', path: '/devices', note: 'Trusted device, revoke session, theo dõi client/device persistence.' },
];

const backendModules = [
  'delivery/http: router, handler, request/response binding, middleware wiring',
  'usecase: orchestration logic cho auth, policy resolution, session, token, step-up',
  'domain: entity/model nghiệp vụ độc lập framework',
  'infrastructure/persistence: GORM repositories, sync menu, seed, sync auth client/channel/policy',
  'authorization/permission: permission registry và scope model',
  'security/password: password hashing, history, one-time password lifecycle',
  'jwt: access token, refresh token, rotation, validation',
];

const frontendModules = [
  'routes/routeConfig.tsx: route tree, protected pages, editor pages, callback routes',
  'components/layout: admin shell, sidebar, header, breadcrumb, page header',
  'components/auth-clients & components/security: editor pages lớn cho auth runtime',
  'pages/*: list management, create/edit flows, docs, logs, settings',
  'lib/api.ts: typed API client và adapter cho backend response',
  'context/AuthContext.tsx: auth state, session bootstrap, one-time password flow',
  'auth/permissions.ts: permission constant cho UI gate',
];

const operationsChecklist = [
  'Khởi động backend rồi kiểm tra SyncMenus / SyncAuthClients / SyncLoginChannels / SyncReferenceOptions đã chạy.',
  'Đảm bảo user mới dùng đúng allowed_clients và allowed_channels nếu giới hạn theo platform.',
  'Khi rotate secret hoặc sửa policy nhạy cảm, step-up phải pass trước rồi mới commit thay đổi.',
  'Khi test login issue, kiểm tra client_id, channel, policy auth, trusted device và session TTL cùng lúc.',
  'Khi thay đổi SSO provider, luôn verify redirect_uri, authorize_url, token_url và userinfo mapping.',
];

const securityConfigGuides = [
  {
    title: 'User Security & Access Boundary',
    route: '/users',
    summary: 'Dùng để quyết định user đăng nhập ở đâu, với tầng xác thực nào và trong bối cảnh nào.',
    fields: [
      '`one_time_password`: dùng cho mật khẩu tạm, buộc đổi ngay sau login đầu tiên.',
      '`require_otp`: ép OTP theo phiên khi account chưa đủ an toàn chỉ với password.',
      '`two_factor_enabled`: bật TOTP cho tài khoản nhạy cảm hoặc tài khoản quản trị.',
      '`password_expires_at`: dùng cho account cần vòng đời mật khẩu hữu hạn.',
      '`allowed_clients`: giới hạn app boundary như web, crm, mobile hay partner.',
      '`allowed_channels`: giới hạn bề mặt truy cập như web/mobile/kiosk/API.',
    ],
  },
  {
    title: 'Security Policy Runtime',
    route: '/security-policies',
    summary: 'Đây là lớp runtime trung tâm để auth server quyết định cách đăng nhập, TTL, rate limit và step-up.',
    fields: [
      '`policy_type`: tách nhóm rule như auth, password hoặc step_up.',
      '`scope_type`: quyết định policy áp global, theo client, theo channel hay kết hợp cả hai.',
      '`target_client` và `target_channel`: dùng khi cần override cho một boundary cụ thể.',
      '`priority`: policy số nhỏ hơn được resolve trước nếu cùng scope.',
      '`require_mfa`, `allow_password`, `allow_sso`: bật/tắt cơ chế xác thực ở runtime.',
      '`session_ttl_minutes`, `refresh_ttl_minutes`, `trusted_device_ttl_hours`: kiểm soát vòng đời session/token/device trust.',
      '`login_*`: lớp rate limit / brute-force theo IP và theo identity.',
      '`target_action` + `require_step_up`: chỉ dùng cho action nhạy cảm như reset password, rotate secret, revoke device.',
    ],
  },
  {
    title: 'OAuth Client Governance',
    route: '/auth-clients',
    summary: 'Client đại diện cho application hoặc service đang xin token, không phải là policy.',
    fields: [
      '`client_id`: định danh app, nên theo chuẩn tenant.app.env.',
      '`client_template`: preset để tạo nhanh boundary đúng cho web, mobile, service hoặc partner.',
      '`public` và `pkce_required`: bắt buộc hiểu đúng khi cấu hình SPA/mobile.',
      '`grant_types`: flow mà client được phép dùng, không nên bật thừa.',
      '`audiences`: chống token reuse sai resource server.',
      '`channels`: map client với bề mặt đăng nhập được phép dùng nó.',
      '`redirect_uris`: chỉ whitelist callback hợp lệ, tránh open redirect.',
    ],
  },
  {
    title: 'Service Account',
    route: '/service-accounts',
    summary: 'Service account là machine-to-machine client, không phải user login thông thường.',
    fields: [
      '`client_credentials`: grant chuẩn cho worker, cronjob, microservice và integration backend.',
      '`internal_service`: app type phù hợp để tránh trộn semantics với web/mobile client.',
      '`client_secret`: phải giữ phía server hoặc vault/KMS, không phát tán sang public client.',
      '`audiences`: giới hạn service token chỉ gọi đúng API/resource server cần thiết.',
      '`channels`: với service account nên cố định ở `service`, không dùng như human login channel.',
    ],
  },
  {
    title: 'Login Channel Runtime',
    route: '/login-channels',
    summary: 'Login channel mô tả bề mặt truy cập và risk boundary, không thay thế cho OAuth client.',
    fields: [
      '`code`: định danh bề mặt truy cập như web, mobile, crm, kiosk, partner, service.',
      '`risk_level`: phục vụ policy MFA, OTP, trusted device, step-up và vận hành security review.',
      '`require_mfa`: ép xác thực mạnh hơn ngay ở channel có rủi ro cao.',
      '`allow_password` / `allow_sso`: đóng hoặc mở phương thức login theo từng channel.',
      '`trusted_device_ttl_hours` / `session_ttl_minutes`: TTL mặc định trước khi bị policy override.',
    ],
  },
  {
    title: 'SSO Provider Registry',
    route: '/sso-providers',
    summary: 'SSO provider quyết định hệ thống sẽ federation với IdP nào và callback ra sao.',
    fields: [
      '`provider_id`: mã định danh nội bộ của IdP trong hệ thống.',
      '`type`: chọn OIDC, OAuth2 hay SAML theo chuẩn integration của đối tác/enterprise IdP.',
      '`authorize_url`, `token_url`, `user_info_url`: endpoint cần cho code exchange và profile mapping.',
      '`redirect_uri`: callback đã whitelist ở IdP, sai URI là lỗi cấu hình phổ biến nhất.',
      '`scope`: với OIDC thường cần ít nhất openid/profile/email để local user mapping đủ dữ liệu.',
      '`allow_auto_provision`: chỉ bật khi policy cho phép tạo local user từ identity bên ngoài.',
    ],
  },
  {
    title: 'Security Policy Runtime',
    route: '/security-policies',
    summary: 'Policy là lớp runtime quyết định auth/session/rate-limit/step-up theo scope cụ thể.',
    fields: [
      '`policy_type`: auth, password hoặc step_up để tách nhóm rule rõ ràng.',
      '`scope_type`: global, client, channel hoặc client_channel để định mức override.',
      '`priority`: số nhỏ hơn được resolve trước khi nhiều policy cùng khớp.',
      '`target_client` / `target_channel`: khóa policy vào đúng security boundary cần kiểm soát.',
      '`session_ttl_minutes`, `refresh_ttl_minutes`, `trusted_device_ttl_hours`, `step_up_ttl_minutes`: các TTL runtime quan trọng.',
      '`login_* attempts/window/block`: rule chống brute-force theo IP và identity.',
      '`target_action` + `require_step_up`: dùng cho action nhạy cảm như rotate secret, reset password, revoke device.',
    ],
  },
];

const securityReviewChecklist = [
  'Tài khoản nội bộ bình thường: dùng password mạnh + one-time password khi cấp mới, chỉ bật OTP/TOTP nếu policy hoặc mức nhạy cảm yêu cầu.',
  'Tài khoản quản trị: ưu tiên TOTP, hạn chế channel, hạn chế client, và thêm step-up cho action nhạy cảm.',
  'Mobile/SPA: phải map đúng public client + PKCE, không giữ client secret.',
  'Service account: chỉ dùng client_credentials, không cần redirect URI, không được gắn login channel kiểu human.',
  'Khi gặp lỗi login: debug theo thứ tự client -> channel -> policy -> user boundary -> MFA/step-up -> session/token.',
];

const authFlow = `User/App -> /auth/login hoặc /auth/authorize
  -> Validate client + channel + policy
  -> Password / SSO / OTP / TOTP
  -> Risk / step-up evaluation
  -> Issue access token + refresh token
  -> Persist session + device + refresh family
  -> API Gateway / backend validate JWT + audience + permission + scope`;

const systemMap = `Frontend (React/Vite)
  |- AuthContext, ProtectedRoute, routeConfig
  |- AdminShell / AdminFormShell / typed API client
  |- Feature pages: users, roles, policies, clients, logs, docs

Backend (Go/Gin/GORM)
  |- HTTP delivery + middleware
  |- Usecase orchestration
  |- Permission / policy resolution
  |- Persistence repositories + sync/seed
  |- JWT / session / token / audit / OTP / SSO

Storage
  |- PostgreSQL: users, roles, permissions, menus, policies, clients, channels, logs
  |- Redis-ready concepts already modeled at runtime: rate limit, refresh reuse, session/device policy`;

export default function DocsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const startTour = (kind: 'overview' | 'operations') => {
    const tour = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      steps: kind === 'overview'
        ? [
            { element: '[data-tour="sidebar-brand"]', popover: { title: 'Sidebar Brand', description: 'Entry point của admin shell. Từ đây user định vị dashboard và không gian vận hành.' } },
            { element: '[data-tour="header-actions"]', popover: { title: 'Header Actions', description: 'Dark mode, settings và các action nhanh nằm ở header dùng chung.' } },
            { element: '[data-tour="docs-tabs"]', popover: { title: 'Docs Tabs', description: 'Tài liệu được chia theo overview, vận hành, backend, frontend và auth flow.' } },
            { element: '[data-tour="docs-quick-links"]', popover: { title: 'Quick Links', description: 'Đi thẳng tới các module trọng yếu để học qua UI thật thay vì chỉ đọc tài liệu.' } },
          ]
        : [
            { element: '[data-tour="docs-runbook"]', popover: { title: 'Runbook', description: 'Checklist vận hành hàng ngày cho admin, ops và security reviewer.' } },
            { element: '[data-tour="docs-architecture"]', popover: { title: 'Architecture Map', description: 'Sơ đồ text mô tả Frontend/Backend/Storage và các lớp chính trong hệ thống.' } },
            { element: '[data-tour="docs-auth-flow"]', popover: { title: 'Auth Flow', description: 'Luồng xác thực chuẩn để debug login, session, refresh token và policy.' } },
          ],
    });
    tour.drive();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Docs & Guides"
        subtitle="Tài liệu vận hành nội bộ ngay trong hệ thống: cách dùng, kiến trúc Go/React, auth runtime và quick tour cho người mới."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => startTour('overview')}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Tour tổng quan
            </Button>
            <Button onClick={() => startTour('operations')}>
              <Sparkles className="mr-2 h-4 w-4" />
              Tour vận hành
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminCard className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <BookOpenText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tài liệu sử dụng và vận hành</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Phiên bản docs này bám theo chính codebase hiện tại của hệ thống.</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList data-tour="docs-tabs" className="h-auto flex-wrap justify-start rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
                <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                <TabsTrigger value="ops">Vận hành</TabsTrigger>
                <TabsTrigger value="security-config">Security Config</TabsTrigger>
                <TabsTrigger value="backend">Go Backend</TabsTrigger>
                <TabsTrigger value="frontend">React Frontend</TabsTrigger>
                <TabsTrigger value="auth">Auth Flow</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <AdminCard className="border-none bg-slate-50/70 p-4 shadow-none dark:bg-slate-950/40" data-tour="docs-architecture">
                  <div className="mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Boxes className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-semibold">Sơ đồ hệ thống</h3>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-600 dark:text-slate-300">{systemMap}</pre>
                </AdminCard>

                <div className="grid gap-4 md:grid-cols-3">
                  <InfoCard icon={Shield} title="Authentication" text="Password, OTP/TOTP, trusted device, step-up, SSO và policy runtime theo client/channel." />
                  <InfoCard icon={Workflow} title="Authorization" text="RBAC hiện tại, đã sẵn sàng mở rộng theo policy context và ABAC khi scale." />
                  <InfoCard icon={Database} title="Persistence" text="PostgreSQL là source of truth cho user, role, menu, policy, session và audit." />
                </div>
              </TabsContent>

              <TabsContent value="ops" className="space-y-4">
                <AdminCard className="border-none bg-slate-50/70 p-4 shadow-none dark:bg-slate-950/40" data-tour="docs-runbook">
                  <div className="mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Rocket className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-semibold">Checklist vận hành</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {operationsChecklist.map((item) => (
                      <div key={item} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                        {item}
                      </div>
                    ))}
                  </div>
                </AdminCard>
              </TabsContent>

              <TabsContent value="security-config" className="space-y-4">
                <SectionTitle icon={Shield} title="Hướng Dẫn Security Config" />
                <div className="grid gap-4">
                  {securityConfigGuides.map((guide) => (
                    <AdminCard key={guide.title} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{guide.title}</p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{guide.summary}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate(guide.route)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Mở màn hình
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {guide.fields.map((field) => (
                          <div key={field} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                            {field}
                          </div>
                        ))}
                      </div>
                    </AdminCard>
                  ))}
                </div>
                <AdminCard className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Checklist review nhanh</h3>
                  </div>
                  <div className="space-y-2">
                    {securityReviewChecklist.map((item) => (
                      <div key={item} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                        {item}
                      </div>
                    ))}
                  </div>
                </AdminCard>
              </TabsContent>

              <TabsContent value="backend" className="space-y-4">
                <SectionTitle icon={ServerCog} title="Cấu trúc Go Backend" />
                <ListCard items={backendModules} />
              </TabsContent>

              <TabsContent value="frontend" className="space-y-4">
                <SectionTitle icon={Compass} title="Cấu trúc React Frontend" />
                <ListCard items={frontendModules} />
              </TabsContent>

              <TabsContent value="auth" className="space-y-4">
                <AdminCard className="border-none bg-slate-50/70 p-4 shadow-none dark:bg-slate-950/40" data-tour="docs-auth-flow">
                  <div className="mb-3 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-semibold">Luồng xác thực chuẩn</h3>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-slate-600 dark:text-slate-300">{authFlow}</pre>
                </AdminCard>
                <ListCard
                  items={[
                    'Access token nên ngắn hạn, refresh token luôn rotate và detect reuse.',
                    'Client và Login Channel là hai khái niệm khác nhau: app boundary vs UX/risk boundary.',
                    'Security policy override theo global -> client -> channel -> client_channel.',
                    'Step-up áp theo action nhạy cảm, không hard-code cứng theo route nữa.',
                  ]}
                />
              </TabsContent>
            </Tabs>
          </div>
        </AdminCard>

        <div className="space-y-6">
          <AdminCard className="p-5" data-tour="docs-quick-links">
            <div className="mb-4 flex items-center gap-2">
              <Compass className="h-4 w-4 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Quick links học nhanh</h3>
            </div>
            <div className="space-y-3">
              {quickLinks.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Workflow tours xuyên route</h3>
            </div>
            <div className="space-y-3">
              {workflowTours.map((tour) => (
                <button
                  key={tour.id}
                  type="button"
                  onClick={() => startWorkflowTour(tour.id, navigate)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{tour.label}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tour.description}</p>
                    </div>
                    <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  </div>
                </button>
              ))}
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Guide cho dev mới vào dự án</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <GuideItem title="1. Hiểu menu và permission" text="Mọi màn admin đều đi qua menu DB và permission registry; nếu route mới không hiện, kiểm tra SyncMenus + permission code." />
              <GuideItem title="2. Trace flow theo route -> API -> usecase" text="Frontend gọi typed API, backend qua router/handler/usecase. Debug nên đọc theo chiều này để không lạc logic." />
              <GuideItem title="3. Nhìn policy trước khi sửa auth" text="Nhiều lỗi login/session không nằm ở UI mà ở client/channel/policy/trusted-device/step-up." />
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <AdminCard className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-500" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
    </AdminCard>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
      <Icon className="h-4 w-4 text-emerald-500" />
      <h3 className="font-semibold">{title}</h3>
    </div>
  );
}

function ListCard({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <AdminCard key={item} className="p-4">
          <div className="flex items-start gap-3">
            <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{item}</p>
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

function GuideItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}
