import React, { useEffect, useState } from 'react';
import { BookOpenText, Boxes, Compass, Database, ExternalLink, GitBranch, PlayCircle, Rocket, ScrollText, ServerCog, Shield, Sparkles, Workflow } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

type EndpointDoc = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  notes?: string[];
};

type BackendApiSection = {
  id: string;
  title: string;
  summary: string;
  endpoints: EndpointDoc[];
};

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
    id: 'user-security-access-boundary',
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
    id: 'security-policy-runtime-core',
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
    id: 'oauth-client-governance',
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
    id: 'service-account',
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
    id: 'reference-options',
    title: 'Reference Options Catalog',
    route: '/reference-options',
    summary: 'Catalog DB-backed cho dropdown, template metadata và option mở rộng mà UI/runtime cùng dùng.',
    fields: [
      '`option_group`: nhóm logic như policy_type, client_template, channel_risk_level hoặc step_up_action.',
      '`value`: giá trị kỹ thuật ổn định dùng trong DB và runtime; không nên đổi bừa nếu đã có dữ liệu sống.',
      '`label`: text hiển thị cho admin trong select/table mà không ảnh hưởng logic runtime.',
      '`sort_order`: thứ tự render option trong dropdown hoặc danh sách.',
      '`meta_json`: metadata mở rộng cho template phức tạp, ví dụ grant mặc định, app_type hoặc channel mặc định.',
      '`active`: ẩn option khỏi UI query active mà không cần xóa cứng dữ liệu lịch sử.',
    ],
  },
  {
    id: 'login-channel-runtime',
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
    id: 'sso-provider-registry',
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
    id: 'security-policy-runtime-detailed',
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

const backendApiConventions = [
  '`Base URL`: tất cả API đi qua `/api/v1`, riêng health check là `/health`.',
  '`Response envelope`: backend trả theo dạng `{ success, data }`; lỗi trả `{ success: false, error }`.',
  '`Bearer token`: route private yêu cầu `Authorization: Bearer <access_token>`.',
  '`Step-up token`: thao tác nhạy cảm gửi thêm `X-Step-Up-Token` sau khi gọi `POST /auth/step-up`.',
  '`Refresh token`: FE tự gọi `POST /auth/refresh` khi access token hết hạn; refresh token cũng được rotate.',
  '`Pagination`: đa số list API dùng `page`, `page_size` và trả `{ data, total, page, page_size, total_pages }`.',
  '`Authorization`: backend không tin permission trong JWT; middleware luôn load permission mới từ DB rồi mới authorize.',
];

const backendApiSections: BackendApiSection[] = [
  {
    id: 'backend-public-auth',
    title: 'Public Auth & OAuth Entry',
    summary: 'Nhóm API không cần JWT, dùng cho login, OAuth2/OIDC entrypoint, SSO callback và password recovery.',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/login',
        description: 'Đăng nhập username/password cho flow trực tiếp hoặc legacy password-style flow nội bộ.',
        notes: [
          'Payload thường gồm `username`, `password`, `client_id`, `channel`, `device_name`, `device_fingerprint`, `otp_code`, `trust_device`.',
          'Response trả `access_token`, `refresh_token`, `user` và các cờ `must_change_password`, `one_time_password`, `password_expired`.',
        ],
      },
      {
        method: 'POST',
        path: '/auth/authorize',
        description: 'Entry cho `authorization_code + PKCE`, trả authorization code nội bộ để FE/app exchange tiếp qua `/auth/token`.',
        notes: [
          'Payload có `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method`, cộng với credential user.',
          'Dùng cho web portal, CRM SPA, mobile app public client.',
        ],
      },
      {
        method: 'POST',
        path: '/auth/token',
        description: 'Exchange token cho `authorization_code` hoặc phát token `client_credentials` cho service account.',
        notes: [
          'Authorization code flow dùng `client_id`, `client_secret?`, `code`, `redirect_uri`, `code_verifier`, `grant_type=authorization_code`.',
          'Service account dùng `client_id`, `client_secret`, `grant_type=client_credentials`.',
        ],
      },
      {
        method: 'POST',
        path: '/auth/refresh',
        description: 'Đổi refresh token sang access token mới và refresh token mới sau rotation.',
        notes: [
          'Payload chỉ cần `refresh_token`.',
          'Nếu detect reuse thì session/token family sẽ bị revoke toàn bộ.',
        ],
      },
      {
        method: 'POST',
        path: '/auth/forgot-password',
        description: 'Khởi tạo quên mật khẩu, gửi token reset qua kênh notification backend hỗ trợ.',
      },
      {
        method: 'POST',
        path: '/auth/reset-password',
        description: 'Đặt lại mật khẩu bằng token reset một lần.',
      },
      {
        method: 'POST',
        path: '/auth/verify-email',
        description: 'Xác minh email bằng token verify ngắn hạn.',
      },
      {
        method: 'GET',
        path: '/auth/sso/providers',
        description: 'Lấy danh sách SSO provider đang bật để FE render nút đăng nhập liên kết.',
      },
      {
        method: 'GET',
        path: '/auth/sso/:provider/start',
        description: 'Tạo redirect URL tới IdP theo provider cụ thể.',
      },
      {
        method: 'POST',
        path: '/auth/sso/:provider/complete',
        description: 'Hoàn tất callback SSO, map identity, chạy policy login rồi phát local session/token.',
        notes: [
          'Payload thường có `code`, `state`, `client_id`, `channel`, `device_name`, `device_fingerprint`, `otp_code`, `trust_device`.',
        ],
      },
    ],
  },
  {
    id: 'backend-self-service',
    title: 'Authenticated Self-service',
    summary: 'Nhóm API cho chính user đang đăng nhập: profile, đổi mật khẩu, step-up, session và 2FA.',
    endpoints: [
      { method: 'POST', path: '/auth/logout', description: 'Đăng xuất session hiện tại.' },
      { method: 'GET', path: '/auth/me', description: 'Lấy profile, roles, permissions, allowed_clients và allowed_channels của user hiện tại.' },
      { method: 'PUT', path: '/auth/change-password', description: 'Đổi mật khẩu từ session đang đăng nhập; áp password policy và password history.' },
      { method: 'POST', path: '/auth/send-verification-email', description: 'Gửi lại email verify.' },
      {
        method: 'POST',
        path: '/auth/step-up',
        description: 'Lấy step-up token ngắn hạn để xác nhận lại thao tác nhạy cảm.',
        notes: [
          'Payload gồm `password` và có thể kèm `otp_code` nếu account yêu cầu MFA.',
          'Response có `step_up_token` và `expires_at`; FE gửi qua header `X-Step-Up-Token` cho các action protected.',
        ],
      },
      { method: 'GET', path: '/auth/sessions', description: 'Liệt kê active sessions của user hiện tại.' },
      { method: 'DELETE', path: '/auth/sessions/:id', description: 'Revoke một session cụ thể; đang được bảo vệ bằng action policy `session.revoke`.' },
      { method: 'DELETE', path: '/auth/sessions', description: 'Revoke toàn bộ session của chính user.' },
      { method: 'POST', path: '/auth/2fa/setup', description: 'Khởi tạo TOTP secret và QR code URL.' },
      { method: 'POST', path: '/auth/2fa/verify', description: 'Xác nhận mã TOTP để bật 2FA.' },
      { method: 'POST', path: '/auth/2fa/disable', description: 'Tắt 2FA; cần step-up theo action `2fa.disable`.' },
      { method: 'GET', path: '/my-menus', description: 'Lấy menu đã filter theo permission của user; sidebar dùng endpoint này.' },
    ],
  },
  {
    id: 'backend-user-access',
    title: 'User / Role / Permission / Menu',
    summary: 'Nhóm quản trị truy cập người dùng và authorization runtime nền tảng.',
    endpoints: [
      { method: 'GET', path: '/users', description: 'Danh sách user có pagination, search và scope filter từ middleware.' },
      { method: 'GET', path: '/users/:id', description: 'Chi tiết user để edit.' },
      { method: 'POST', path: '/users', description: 'Tạo user mới với role_ids, password boundary, allowed_clients và allowed_channels.' },
      { method: 'PUT', path: '/users/:id', description: 'Cập nhật thông tin và boundary của user.' },
      { method: 'DELETE', path: '/users/:id', description: 'Xóa user; route này hiện còn dùng RequireStepUp cứng.' },
      { method: 'POST', path: '/users/:id/reset-password', description: 'Reset password admin-side; bảo vệ bởi action policy `user.reset_password`.' },
      { method: 'GET', path: '/roles', description: 'Danh sách role có pagination.' },
      { method: 'GET', path: '/roles/:id', description: 'Chi tiết role.' },
      { method: 'POST', path: '/roles', description: 'Tạo role mới.' },
      { method: 'PUT', path: '/roles/:id', description: 'Cập nhật role.' },
      { method: 'DELETE', path: '/roles/:id', description: 'Xóa role.' },
      { method: 'PUT', path: '/roles/:id/permissions', description: 'Gán permission cho role; action policy `role.assign_permissions` có thể ép step-up.' },
      { method: 'GET', path: '/permissions', description: 'Lấy danh sách permission registry và permission lines.' },
      { method: 'POST', path: '/permissions', description: 'Tạo permission mới.' },
      { method: 'POST', path: '/permissions/:code/lines', description: 'Thêm controller/action line cho permission.' },
      { method: 'DELETE', path: '/permissions/:code/lines/:lineID', description: 'Xóa permission line.' },
      { method: 'GET', path: '/menus', description: 'Danh sách menu quản trị có pagination.' },
      { method: 'POST', path: '/menus', description: 'Tạo menu mới.' },
      { method: 'PUT', path: '/menus/:id', description: 'Cập nhật menu.' },
      { method: 'DELETE', path: '/menus/:id', description: 'Xóa menu.' },
    ],
  },
  {
    id: 'backend-auth-governance',
    title: 'OAuth / Client / Channel / Policy Governance',
    summary: 'Nhóm API quản trị security boundary của app, service, channel, SSO và policy runtime.',
    endpoints: [
      { method: 'GET', path: '/auth-clients', description: 'Danh sách OAuth clients với filter app_type, search, pagination.' },
      { method: 'GET', path: '/auth-clients/:id', description: 'Chi tiết auth client.' },
      { method: 'POST', path: '/auth-clients', description: 'Tạo OAuth client mới; thường cần step-up trước khi submit.' },
      { method: 'PUT', path: '/auth-clients/:id', description: 'Cập nhật auth client.' },
      { method: 'POST', path: '/auth-clients/:id/rotate-secret', description: 'Rotate client secret; action policy `client.rotate_secret`.' },
      { method: 'DELETE', path: '/auth-clients/:id', description: 'Xóa auth client; action policy `client.delete`.' },
      { method: 'GET', path: '/service-accounts', description: 'Danh sách service account dùng chung entity client nhưng semantics M2M.' },
      { method: 'GET', path: '/service-accounts/:id', description: 'Chi tiết service account.' },
      { method: 'POST', path: '/service-accounts', description: 'Tạo service account mới.' },
      { method: 'PUT', path: '/service-accounts/:id', description: 'Cập nhật service account.' },
      { method: 'POST', path: '/service-accounts/:id/rotate-secret', description: 'Rotate secret cho service account.' },
      { method: 'DELETE', path: '/service-accounts/:id', description: 'Xóa service account.' },
      { method: 'GET', path: '/sso-providers', description: 'Danh sách SSO provider DB-backed.' },
      { method: 'GET', path: '/sso-providers/:id', description: 'Chi tiết SSO provider.' },
      { method: 'POST', path: '/sso-providers', description: 'Tạo SSO provider mới.' },
      { method: 'PUT', path: '/sso-providers/:id', description: 'Cập nhật SSO provider.' },
      { method: 'DELETE', path: '/sso-providers/:id', description: 'Xóa SSO provider.' },
      { method: 'GET', path: '/login-channels', description: 'Danh sách login channel, risk level và TTL mặc định.' },
      { method: 'GET', path: '/login-channels/:id', description: 'Chi tiết login channel.' },
      { method: 'POST', path: '/login-channels', description: 'Tạo login channel.' },
      { method: 'PUT', path: '/login-channels/:id', description: 'Cập nhật login channel.' },
      { method: 'DELETE', path: '/login-channels/:id', description: 'Xóa login channel.' },
      { method: 'GET', path: '/security-policies', description: 'Danh sách security policy, filter theo `policy_type`, `scope_type`, `active`.' },
      { method: 'GET', path: '/security-policies/:id', description: 'Chi tiết security policy.' },
      { method: 'POST', path: '/security-policies', description: 'Tạo policy mới.' },
      { method: 'PUT', path: '/security-policies/:id', description: 'Cập nhật policy; action policy `policy.update` có thể yêu cầu step-up.' },
      { method: 'DELETE', path: '/security-policies/:id', description: 'Xóa policy; action policy `policy.delete`.' },
      { method: 'GET', path: '/reference-options', description: 'Catalog option DB-backed cho dropdown/runtime metadata.' },
      { method: 'GET', path: '/reference-options/:id', description: 'Chi tiết reference option.' },
      { method: 'POST', path: '/reference-options', description: 'Tạo option mới.' },
      { method: 'PUT', path: '/reference-options/:id', description: 'Cập nhật option.' },
      { method: 'DELETE', path: '/reference-options/:id', description: 'Xóa option.' },
    ],
  },
  {
    id: 'backend-observability',
    title: 'Audit / Device / Session Observability',
    summary: 'Nhóm API phục vụ vận hành, audit trail, trusted device và session revocation theo device.',
    endpoints: [
      { method: 'GET', path: '/logs/audit', description: 'Danh sách audit log; hỗ trợ `search`, `user`, `action`, `from`, `to`, pagination.' },
      { method: 'GET', path: '/logs/auth', description: 'Lịch sử auth/login riêng.' },
      { method: 'GET', path: '/devices', description: 'Danh sách device/session theo user/client/trusted state.' },
      { method: 'DELETE', path: '/devices/:id', description: 'Revoke device/session theo device; action policy `device.revoke`.' },
    ],
  },
];

const backendApiExamples = [
  {
    title: 'Login password + channel + device',
    body: `POST /api/v1/auth/login
{
  "username": "superadmin",
  "password": "Admin@123",
  "client_id": "web_portal",
  "channel": "web",
  "device_name": "Chrome Windows",
  "device_fingerprint": "browser-fingerprint",
  "trust_device": true
}`,
  },
  {
    title: 'Authorization code + PKCE exchange',
    body: `POST /api/v1/auth/token
{
  "grant_type": "authorization_code",
  "client_id": "mobile_customer",
  "code": "auth-code",
  "redirect_uri": "myapp://oauth/callback",
  "code_verifier": "pkce-verifier"
}`,
  },
  {
    title: 'Service account client_credentials',
    body: `POST /api/v1/auth/token
{
  "grant_type": "client_credentials",
  "client_id": "payment_service",
  "client_secret": "rotated-secret"
}`,
  },
  {
    title: 'Step-up rồi cập nhật policy',
    body: `POST /api/v1/auth/step-up
{
  "password": "Admin@123",
  "otp_code": "123456"
}

PUT /api/v1/security-policies/12
Headers:
  Authorization: Bearer <access_token>
  X-Step-Up-Token: <step_up_token>`,
  },
];

export default function DocsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const section = searchParams.get('section');
    const tabParam = searchParams.get('tab');
    if (!section || !tabParam || tab !== tabParam) return;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(section);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchParams, tab]);

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
                    <AdminCard key={guide.id} id={guide.id} className="p-5 scroll-mt-24">
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
                <AdminCard className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <ServerCog className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">API conventions</h3>
                  </div>
                  <div className="space-y-2">
                    {backendApiConventions.map((item) => (
                      <div key={item} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                        {item}
                      </div>
                    ))}
                  </div>
                </AdminCard>
                <div className="grid gap-4">
                  {backendApiSections.map((section) => (
                    <BackendApiCard key={section.id} section={section} />
                  ))}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {backendApiExamples.map((example) => (
                    <AdminCard key={example.title} className="p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <ScrollText className="h-4 w-4 text-emerald-500" />
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{example.title}</h3>
                      </div>
                      <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs leading-6 text-emerald-100 dark:border-slate-800">
                        {example.body}
                      </pre>
                    </AdminCard>
                  ))}
                </div>
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

function BackendApiCard({ section }: { section: BackendApiSection }) {
  return (
    <AdminCard id={section.id} className="p-5 scroll-mt-24">
      <div className="mb-4">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{section.title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{section.summary}</p>
      </div>
      <div className="space-y-3">
        {section.endpoints.map((endpoint) => (
          <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {endpoint.method}
              </span>
              <code className="text-sm font-medium text-slate-900 dark:text-slate-100">{endpoint.path}</code>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{endpoint.description}</p>
            {endpoint.notes?.length ? (
              <div className="mt-3 space-y-2">
                {endpoint.notes.map((note) => (
                  <div key={note} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    {note}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
