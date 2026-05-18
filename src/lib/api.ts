// ─── API Client (matches backend /api/v1 response format: { success, data }) ──

const BASE_URL = '/api/v1';

let _accessToken: string | null = localStorage.getItem('access_token');
let _onUnauthorized: (() => void) | null = null;
// Prevent multiple concurrent logout triggers
let _unauthorizedHandled = false;
const STEP_UP_TOKEN_KEY = 'step_up_token';
const STEP_UP_EXPIRES_KEY = 'step_up_expires_at';

export function setToken(token: string | null) {
  _accessToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
    _unauthorizedHandled = false; // reset on new login
  } else {
    localStorage.removeItem('access_token');
  }
}

export function getToken() { return _accessToken; }

export function onUnauthorized(cb: () => void) { _onUnauthorized = cb; }

/**
 * Direct fetch for auth endpoints (login, refresh).
 * Does NOT use the global 401 interceptor to avoid logout loops.
 */
async function authRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ success: false, error: 'Lỗi phân tích dữ liệu' }));
  if (!res.ok || !json.success) throw new Error(json.error || 'Lỗi không xác định');
  return json.data as T;
}

/**
 * Standard request for protected endpoints.
 * On 401: attempts token refresh once, then triggers onUnauthorized (logout).
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retried = false
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
  const stepUpToken = getStepUpToken();
  if (stepUpToken) headers['X-Step-Up-Token'] = stepUpToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(method, path, body, true);
    // Only trigger once to avoid reload loops
    if (!_unauthorizedHandled) {
      _unauthorizedHandled = true;
      _onUnauthorized?.();
    }
    throw new Error('Phiên đăng nhập hết hạn');
  }

  const json = await res.json().catch(() => ({ success: false, error: 'Lỗi phân tích dữ liệu' }));
  if (!res.ok || !json.success) throw new Error(json.error || 'Lỗi không xác định');
  return json.data as T;
}

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (!json.success || !json.data) return false;
    const data = json.data as LoginResponse;
    setToken(data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return true;
  } catch { return false; }
}

const get  = <T>(path: string)               => request<T>('GET',    path);
const post = <T>(path: string, body: unknown) => request<T>('POST',   path, body);
const put  = <T>(path: string, body: unknown) => request<T>('PUT',    path, body);
const del  = <T>(path: string)               => request<T>('DELETE', path);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserInfo;
  must_change_password?: boolean;
  password_expired?: boolean;
  password_change_reason?: 'one_time_password' | 'password_expired';
  one_time_password?: boolean; // true = user must change password on first login
  require_password_change?: boolean; // alias from some backends
}

export function setStepUpToken(token: string | null, expiresAt?: string) {
  if (token) {
    localStorage.setItem(STEP_UP_TOKEN_KEY, token);
    if (expiresAt) localStorage.setItem(STEP_UP_EXPIRES_KEY, expiresAt);
  } else {
    localStorage.removeItem(STEP_UP_TOKEN_KEY);
    localStorage.removeItem(STEP_UP_EXPIRES_KEY);
  }
}

export function getStepUpToken() {
  const token = localStorage.getItem(STEP_UP_TOKEN_KEY);
  const expiresAt = localStorage.getItem(STEP_UP_EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  if (new Date(expiresAt).getTime() <= Date.now()) {
    setStepUpToken(null);
    return null;
  }
  return token;
}

export function isStepUpRequiredError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('xác thực lại') || message.includes('step_up') || message.includes('step-up');
}

export async function copyText(value: string) {
  if (!value) throw new Error('Không có dữ liệu để sao chép');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('Trình duyệt không hỗ trợ sao chép tự động');
}

export interface UserInfo {
  id:          number;
  username:    string;
  full_name:   string;
  email:       string;
  phone:       string;
  status:      string;
  roles:       string[];
  permissions: string[]; // "perm:scope" pairs or ["*"]
  allowed_clients?: string[];
  allowed_channels?: string[];
  email_verified?: boolean;
  password_expires_at?: string;
  one_time_password?: boolean;
  require_otp?: boolean;
  two_factor_enabled?: boolean;
}

export interface PaginatedResponse<T> {
  data:        T[];
  total:       number;
  page:        number;
  page_size:   number;
  total_pages: number;
}

// ── User (matches usecase.UserResponse) ──────────────────────────────────────
export interface ApiUser {
  id:        number;
  username:  string;
  full_name: string;
  email:     string;
  email_verified?: boolean;
  phone:     string;
  status:    string;
  roles:     string[];
  role_ids:  number[];
  allowed_clients?: string[];
  allowed_channels?: string[];
  password_expires_at?: string;
  one_time_password?:   boolean;
  require_otp?:         boolean;
  two_factor_enabled?:  boolean;
}

// ── Role (matches usecase.RoleResponse) ──────────────────────────────────────
export interface ApiRole {
  id:               number;
  name:             string;
  description:      string;
  user_count:       number;
  permission_codes: string[];
  scopes:           string[];
}

// ── PermissionLine ────────────────────────────────────────────────────────────
export interface ApiPermissionLine {
  id:            number;
  permission_id: number;
  controller:    string;
  action:        string;
  note:          string;
}

// ── Permission (matches usecase.PermissionResponse) ───────────────────────────
export interface ApiPermission {
  id:          number;
  code:        string; // e.g. "user.read"
  name:        string;
  description: string;
  group_name:  string;
  lines:       ApiPermissionLine[];
}

// ── Menu (matches usecase.MenuResponse) ──────────────────────────────────────
export interface ApiMenu {
  id:              number;
  title:           string;
  url:             string;
  sort_order:      number;
  icon:            string;
  permission_code: string;
  parent_id:       number | null;
  menu_type:       string;
  level:           number;
  children?:       ApiMenu[];
}

export interface SSOProvider {
  id: string;
  name: string;
  type: string;
}

export interface AuthorizeCodeResponse {
  code: string;
  state: string;
  redirect_uri: string;
  expires_at: string;
}

export interface DeviceSession {
  id: string;
  user_id: number;
  username: string;
  email: string;
  device: string;
  ip: string;
  client_id: string;
  trusted: boolean;
  last_active: string;
}

export interface AuthClient {
  id: number;
  client_id: string;
  client_secret: string;
  name: string;
  description: string;
  app_type: string;
  client_template: string;
  environment: string;
  domain_group: string;
  owner_team: string;
  public: boolean;
  pkce_required: boolean;
  active: boolean;
  legacy_password_grant: boolean;
  approval_status: string;
  grant_types: string[];
  redirect_uris: string[];
  audiences: string[];
  channels: string[];
  trusted_types: string[];
  tags: string[];
  secret_version: number;
  secret_rotated_at?: string;
  secret_expires_at?: string;
  created_at: string;
}

export type AuthClientPayload = {
  client_id: string;
  client_secret: string;
  name: string;
  description: string;
  app_type: string;
  client_template: string;
  environment: string;
  domain_group: string;
  owner_team: string;
  public: boolean;
  pkce_required: boolean;
  active: boolean;
  legacy_password_grant: boolean;
  approval_status: string;
  grant_types: string[];
  redirect_uris: string[];
  audiences: string[];
  channels: string[];
  trusted_types: string[];
  tags: string[];
};

export interface AdminSSOProvider {
  id: number;
  provider_id: string;
  name: string;
  type: string;
  client_id: string;
  client_secret: string;
  authorize_url: string;
  token_url: string;
  user_info_url: string;
  redirect_uri: string;
  scope: string;
  saml_login_url: string;
  enabled: boolean;
  allow_auto_provision: boolean;
  icon: string;
  created_at: string;
}

export interface LoginChannel {
  id: number;
  code: string;
  name: string;
  description: string;
  risk_level: string;
  require_mfa: boolean;
  allow_password: boolean;
  allow_sso: boolean;
  trusted_device_ttl_hours: number;
  session_ttl_minutes: number;
  active: boolean;
  created_at: string;
}

export interface SecurityPolicy {
  id: number;
  code: string;
  name: string;
  description: string;
  policy_type: string;
  scope_type: string;
  target_client: string;
  target_channel: string;
  target_action: string;
  priority: number;
  active: boolean;
  config: {
    require_step_up?: boolean;
    require_mfa?: boolean;
    allow_password?: boolean;
    allow_sso?: boolean;
    trusted_device_ttl_hours?: number;
    session_ttl_minutes?: number;
    refresh_ttl_minutes?: number;
    step_up_ttl_minutes?: number;
    login_ip_max_attempts?: number;
    login_ip_window_minutes?: number;
    login_ip_block_minutes?: number;
    login_identity_max_attempts?: number;
    login_identity_window_minutes?: number;
    login_identity_block_minutes?: number;
    password_min_length?: number;
    require_upper?: boolean;
    require_lower?: boolean;
    require_number?: boolean;
    require_special?: boolean;
  };
  config_json: string;
  created_at: string;
}

export interface ReferenceOption {
  id: number;
  option_group: string;
  value: string;
  label: string;
  description: string;
  meta_json: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

const FALLBACK_REFERENCE_OPTIONS: Omit<ReferenceOption, 'id' | 'created_at'>[] = [
  { option_group: 'client_template', value: 'spa_web', label: 'SPA Web', description: 'Public SPA dùng authorization_code + PKCE', meta_json: '{"app_type":"web_app","public":true,"channels":["web"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser"],"pkce_required":true,"audiences":["web-api"],"tags":["portal","spa"]}', sort_order: 10, active: true },
  { option_group: 'client_template', value: 'crm_portal', label: 'CRM Portal', description: 'Confidential client cho backoffice CRM', meta_json: '{"app_type":"admin_portal","public":false,"channels":["crm","web"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser","desktop"],"pkce_required":false,"audiences":["crm-api"],"tags":["crm","backoffice"]}', sort_order: 20, active: true },
  { option_group: 'client_template', value: 'mobile_pkce', label: 'Mobile PKCE', description: 'Public mobile app dùng PKCE', meta_json: '{"app_type":"mobile_app","public":true,"channels":["mobile"],"grants":["authorization_code","refresh_token"],"trusted_types":["mobile"],"pkce_required":true,"audiences":["mobile-api"],"tags":["mobile","public"]}', sort_order: 30, active: true },
  { option_group: 'client_template', value: 'service_m2m', label: 'Internal Service', description: 'Service account dùng client_credentials', meta_json: '{"app_type":"internal_service","public":false,"channels":["service"],"grants":["client_credentials"],"trusted_types":["server"],"pkce_required":false,"audiences":["internal-api"],"tags":["service","internal"]}', sort_order: 40, active: true },
  { option_group: 'client_template', value: 'custom', label: 'Custom', description: 'Template tự do', meta_json: '{"app_type":"web_app","public":true,"channels":["web"],"grants":["authorization_code","refresh_token"],"trusted_types":["browser"],"pkce_required":true,"audiences":["default-api"],"tags":["custom"]}', sort_order: 50, active: true },
  { option_group: 'client_environment', value: 'dev', label: 'Development', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'client_environment', value: 'stg', label: 'Staging', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'client_environment', value: 'prod', label: 'Production', description: '', meta_json: '{}', sort_order: 30, active: true },
  { option_group: 'client_app_type', value: 'web_app', label: 'Web App', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'client_app_type', value: 'mobile_app', label: 'Mobile App', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'client_app_type', value: 'admin_portal', label: 'Admin Portal', description: '', meta_json: '{}', sort_order: 30, active: true },
  { option_group: 'client_app_type', value: 'kiosk', label: 'Kiosk', description: '', meta_json: '{}', sort_order: 40, active: true },
  { option_group: 'client_app_type', value: 'internal_service', label: 'Internal Service', description: '', meta_json: '{}', sort_order: 50, active: true },
  { option_group: 'client_app_type', value: 'partner_api', label: 'Partner API', description: '', meta_json: '{}', sort_order: 60, active: true },
  { option_group: 'client_approval_status', value: 'approved', label: 'Approved', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'client_approval_status', value: 'pending', label: 'Pending Approval', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'client_approval_status', value: 'rejected', label: 'Rejected', description: '', meta_json: '{}', sort_order: 30, active: true },
  { option_group: 'policy_type', value: 'auth', label: 'Auth', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'policy_type', value: 'password', label: 'Password', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'policy_type', value: 'step_up', label: 'Step-up Action', description: '', meta_json: '{}', sort_order: 30, active: true },
  { option_group: 'policy_scope_type', value: 'global', label: 'Global', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'policy_scope_type', value: 'client', label: 'Client', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'policy_scope_type', value: 'channel', label: 'Channel', description: '', meta_json: '{}', sort_order: 30, active: true },
  { option_group: 'policy_scope_type', value: 'client_channel', label: 'Client + Channel', description: '', meta_json: '{}', sort_order: 40, active: true },
  { option_group: 'step_up_action', value: 'client.rotate_secret', label: 'client.rotate_secret', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'step_up_action', value: 'policy.update', label: 'policy.update', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'step_up_action', value: 'device.revoke', label: 'device.revoke', description: '', meta_json: '{}', sort_order: 30, active: true },
  { option_group: 'step_up_action', value: 'user.reset_password', label: 'user.reset_password', description: '', meta_json: '{}', sort_order: 40, active: true },
  { option_group: 'step_up_action', value: 'session.revoke', label: 'session.revoke', description: '', meta_json: '{}', sort_order: 50, active: true },
  { option_group: 'step_up_action', value: '2fa.disable', label: '2fa.disable', description: '', meta_json: '{}', sort_order: 60, active: true },
  { option_group: 'step_up_action', value: 'role.assign_permissions', label: 'role.assign_permissions', description: '', meta_json: '{}', sort_order: 70, active: true },
  { option_group: 'step_up_action', value: 'client.delete', label: 'client.delete', description: '', meta_json: '{}', sort_order: 80, active: true },
  { option_group: 'step_up_action', value: 'policy.delete', label: 'policy.delete', description: '', meta_json: '{}', sort_order: 90, active: true },
  { option_group: 'channel_risk_level', value: 'low', label: 'Low', description: '', meta_json: '{}', sort_order: 10, active: true },
  { option_group: 'channel_risk_level', value: 'medium', label: 'Medium', description: '', meta_json: '{}', sort_order: 20, active: true },
  { option_group: 'channel_risk_level', value: 'high', label: 'High', description: '', meta_json: '{}', sort_order: 30, active: true },
];

function fallbackReferenceOptions(params?: { option_group?: string; active?: string; page?: number; page_size?: number }): PaginatedResponse<ReferenceOption> {
  const page = params?.page || 1;
  const pageSize = params?.page_size || 100;
  let items = FALLBACK_REFERENCE_OPTIONS.map((item, index) => ({
    ...item,
    id: index + 1,
    created_at: new Date(0).toISOString(),
  }));
  if (params?.option_group) items = items.filter(item => item.option_group === params.option_group);
  if (params?.active) items = items.filter(item => item.active === (params.active === 'true'));
  const total = items.length;
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return {
    data,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  // Use authRequest (no global 401 interceptor) so wrong-password errors
  // don't accidentally trigger the session-expired logout handler.
  login: (username: string, password: string, options?: {
    client_id?: string;
    client_secret?: string;
    grant_type?: string;
    channel?: string;
    device_name?: string;
    device_fingerprint?: string;
    otp_code?: string;
    trust_device?: boolean;
  }) =>
    authRequest<LoginResponse>('POST', '/auth/login', { username, password, ...options }),
  logout: async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({ success: false }));
    if (!res.ok && res.status !== 401) throw new Error(json.error || 'Lỗi đăng xuất');
  },
  me: () =>
    get<UserInfo>('/auth/me'),
  refresh: (refreshToken: string) =>
    post<LoginResponse>('/auth/refresh', { refresh_token: refreshToken }),
  changePassword: (old_password: string, new_password: string) =>
    put<void>('/auth/change-password', { old_password, new_password }),
  stepUp: (password: string, otp_code?: string) =>
    post<{ step_up_token: string; expires_at: string }>('/auth/step-up', { password, otp_code }),
  myMenus: () =>
    get<ApiMenu[]>('/my-menus'),
  sessions: () =>
    get<any[]>('/auth/sessions'),
  revokeSession: (sessionId: string) =>
    del<void>(`/auth/sessions/${sessionId}`),
  revokeAllSessions: () =>
    del<void>('/auth/sessions'),
  setup2FA: () =>
    post<{ secret: string; qr_code_url: string }>('/auth/2fa/setup', {}),
  verify2FA: (code: string) =>
    post<void>('/auth/2fa/verify', { code }),
  disable2FA: () =>
    post<void>('/auth/2fa/disable', {}),
  ssoProviders: () =>
    authRequest<SSOProvider[]>('GET', '/auth/sso/providers'),
  startSSO: (provider: string) =>
    authRequest<{ redirect_url: string }>('GET', `/auth/sso/${provider}/start`),
  completeSSO: (provider: string, payload: {
    code: string;
    state: string;
    client_id?: string;
    channel?: string;
    device_name?: string;
    device_fingerprint?: string;
    otp_code?: string;
    trust_device?: boolean;
  }) => authRequest<LoginResponse>('POST', `/auth/sso/${provider}/complete`, payload),
  authorize: (payload: {
    username: string;
    password: string;
    client_id: string;
    redirect_uri: string;
    state?: string;
    scope?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    channel?: string;
    device_name?: string;
    device_fingerprint?: string;
    otp_code?: string;
    trust_device?: boolean;
  }) => authRequest<AuthorizeCodeResponse>('POST', '/auth/authorize', payload),
  exchangeAuthorizationCode: (payload: {
    client_id: string;
    client_secret?: string;
    code: string;
    redirect_uri: string;
    code_verifier: string;
  }) => authRequest<{ access_token: string; token_type: string; expires_at: string; client_id: string; audiences: string[] }>('POST', '/auth/token', {
    ...payload,
    grant_type: 'authorization_code',
  }),
};

export const devicesApi = {
  list: (params?: { search?: string; client_id?: string; trusted?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.client_id) q.set('client_id', params.client_id);
    if (params?.trusted) q.set('trusted', params.trusted);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<DeviceSession>>(`/devices?${q}`);
  },
  revoke: (id: string) => del<void>(`/devices/${id}`),
};

export const clientsApi = {
  list: (params?: { search?: string; app_type?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.app_type) q.set('app_type', params.app_type);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<AuthClient>>(`/auth-clients?${q}`);
  },
  get: (id: number) => get<AuthClient>(`/auth-clients/${id}`),
  create: (data: AuthClientPayload) => post<AuthClient>('/auth-clients', data),
  update: (id: number, data: AuthClientPayload) => put<AuthClient>(`/auth-clients/${id}`, data),
  rotateSecret: (id: number) => post<AuthClient>(`/auth-clients/${id}/rotate-secret`, {}),
  delete: (id: number) => del<void>(`/auth-clients/${id}`),
  token: (client_id: string, client_secret: string) =>
    authRequest<{ access_token: string; token_type: string; expires_at: string; client_id: string; audiences: string[] }>('POST', '/auth/token', {
      client_id,
      client_secret,
      grant_type: 'client_credentials',
    }),
};

export const serviceAccountsApi = {
  list: (params?: { search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    q.set('app_type', 'internal_service');
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<AuthClient>>(`/service-accounts?${q}`);
  },
  get: (id: number) => get<AuthClient>(`/service-accounts/${id}`),
  create: (data: AuthClientPayload) => post<AuthClient>('/service-accounts', data),
  update: (id: number, data: AuthClientPayload) => put<AuthClient>(`/service-accounts/${id}`, data),
  rotateSecret: (id: number) => post<AuthClient>(`/service-accounts/${id}/rotate-secret`, {}),
  delete: (id: number) => del<void>(`/service-accounts/${id}`),
};

export const ssoProvidersAdminApi = {
  list: (params?: { search?: string; type?: string; enabled?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.type) q.set('type', params.type);
    if (params?.enabled) q.set('enabled', params.enabled);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<AdminSSOProvider>>(`/sso-providers?${q}`);
  },
  get: (id: number) => get<AdminSSOProvider>(`/sso-providers/${id}`),
  create: (data: Omit<AdminSSOProvider, 'id' | 'created_at'>) => post<AdminSSOProvider>('/sso-providers', data),
  update: (id: number, data: Omit<AdminSSOProvider, 'id' | 'created_at'>) => put<AdminSSOProvider>(`/sso-providers/${id}`, data),
  delete: (id: number) => del<void>(`/sso-providers/${id}`),
};

export const loginChannelsApi = {
  list: (params?: { search?: string; risk_level?: string; active?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.risk_level) q.set('risk_level', params.risk_level);
    if (params?.active) q.set('active', params.active);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<LoginChannel>>(`/login-channels?${q}`);
  },
  get: (id: number) => get<LoginChannel>(`/login-channels/${id}`),
  create: (data: Omit<LoginChannel, 'id' | 'created_at'>) => post<LoginChannel>('/login-channels', data),
  update: (id: number, data: Omit<LoginChannel, 'id' | 'created_at'>) => put<LoginChannel>(`/login-channels/${id}`, data),
  delete: (id: number) => del<void>(`/login-channels/${id}`),
};

export const securityPoliciesApi = {
  list: (params?: { search?: string; policy_type?: string; scope_type?: string; active?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.policy_type) q.set('policy_type', params.policy_type);
    if (params?.scope_type) q.set('scope_type', params.scope_type);
    if (params?.active) q.set('active', params.active);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<SecurityPolicy>>(`/security-policies?${q}`);
  },
  get: (id: number) => get<SecurityPolicy>(`/security-policies/${id}`),
  create: (data: Omit<SecurityPolicy, 'id' | 'created_at' | 'config_json'>) => post<SecurityPolicy>('/security-policies', data),
  update: (id: number, data: Omit<SecurityPolicy, 'id' | 'created_at' | 'config_json'>) => put<SecurityPolicy>(`/security-policies/${id}`, data),
  delete: (id: number) => del<void>(`/security-policies/${id}`),
};

export const referenceOptionsApi = {
  list: async (params?: { search?: string; option_group?: string; active?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.option_group) q.set('option_group', params.option_group);
    if (params?.active) q.set('active', params.active);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
      const stepUpToken = getStepUpToken();
      if (stepUpToken) headers['X-Step-Up-Token'] = stepUpToken;
      const res = await fetch(`${BASE_URL}/reference-options?${q}`, { method: 'GET', headers });
      if (res.status === 404) {
        return fallbackReferenceOptions(params);
      }
      if (res.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) return referenceOptionsApi.list(params);
      }
      if (res.status === 403) {
        return fallbackReferenceOptions(params);
      }
      const json = await res.json().catch(() => ({ success: false, error: 'Lỗi phân tích dữ liệu' }));
      if (!res.ok || !json.success) throw new Error(json.error || 'Lỗi không xác định');
      return json.data as PaginatedResponse<ReferenceOption>;
    } catch {
      return fallbackReferenceOptions(params);
    }
  },
  get: (id: number) => get<ReferenceOption>(`/reference-options/${id}`),
  create: (data: Omit<ReferenceOption, 'id' | 'created_at'>) => post<ReferenceOption>('/reference-options', data),
  update: (id: number, data: Omit<ReferenceOption, 'id' | 'created_at'>) => put<ReferenceOption>(`/reference-options/${id}`, data),
  delete: (id: number) => del<void>(`/reference-options/${id}`),
};

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: { search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search)    q.set('search',    params.search);
    if (params?.page)      q.set('page',      String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<ApiUser>>(`/users?${q}`);
  },
  get:    (id: number) => get<ApiUser>(`/users/${id}`),
  create: (data: {
    username: string; password: string; full_name: string;
    email: string; phone?: string; status?: string; role_ids?: number[];
    password_expires_at?: string; one_time_password?: boolean;
    require_otp?: boolean; two_factor_enabled?: boolean;
    allowed_clients?: string[]; allowed_channels?: string[];
  }) => post<ApiUser>('/users', data),
  update: (id: number, data: {
    full_name?: string; email?: string; phone?: string;
    status?: string; role_ids?: number[];
    password_expires_at?: string; one_time_password?: boolean;
    require_otp?: boolean; two_factor_enabled?: boolean;
    allowed_clients?: string[]; allowed_channels?: string[];
  }) => put<ApiUser>(`/users/${id}`, data),
  delete: (id: number) => del<void>(`/users/${id}`),
  resetPassword: (id: number, password: string, one_time_password = true) =>
    post<void>(`/users/${id}/reset-password`, { password, one_time_password }),
};

// ─── Roles API ────────────────────────────────────────────────────────────────

export const rolesApi = {
  list: (params?: { search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search)    q.set('search',    params.search);
    if (params?.page)      q.set('page',      String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<ApiRole>>(`/roles?${q}`);
  },
  get:    (id: number) => get<ApiRole>(`/roles/${id}`),
  create: (data: { name: string; description?: string }) =>
    post<ApiRole>('/roles', data),
  update: (id: number, data: { name?: string; description?: string }) =>
    put<ApiRole>(`/roles/${id}`, data),
  delete: (id: number) => del<void>(`/roles/${id}`),
  // Assign: sends array of { code, scope } pairs
  assignPermissions: (id: number, permissions: Array<{ code: string; scope: string }>) =>
    put<void>(`/roles/${id}/permissions`, { permissions }),
};

// ─── Permissions API ──────────────────────────────────────────────────────────

export const permissionsApi = {
  // Returns all permission defs (no pagination — static list from registry)
  list: () => get<ApiPermission[]>('/permissions'),
  create: (data: { code: string; name: string; description?: string; group_name: string }) =>
    post<ApiPermission>('/permissions', data),
  update: (id: number, data: { code?: string; name?: string; description?: string; group_name?: string }) =>
    put<ApiPermission>(`/permissions/${id}`, data),
  delete: (id: number) =>
    del<void>(`/permissions/${id}`),
  addLine: (code: string, data: { controller: string; action: string; note?: string }) =>
    post<ApiPermissionLine>(`/permissions/${code}/lines`, data),
  deleteLine: (code: string, lineID: number) =>
    del<void>(`/permissions/${code}/lines/${lineID}`),
};

// ─── Menus API ────────────────────────────────────────────────────────────────

export const menusApi = {
  list: (params?: { search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search)    q.set('search',    params.search);
    if (params?.page)      q.set('page',      String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<ApiMenu>>(`/menus?${q}`);
  },
  myMenus: () => get<ApiMenu[]>('/my-menus'),
  get:     (id: number) => get<ApiMenu>(`/menus/${id}`),
  create:  (data: {
    title: string; url?: string; sort_order?: number;
    icon?: string; permission_code?: string; parent_id?: number | null; menu_type?: string;
  }) => post<ApiMenu>('/menus', data),
  update: (id: number, data: {
    title?: string; url?: string; sort_order?: number;
    icon?: string; permission_code?: string; parent_id?: number | null;
  }) => put<ApiMenu>(`/menus/${id}`, data),
  delete: (id: number) => del<void>(`/menus/${id}`),
};

// ─── Logs API ─────────────────────────────────────────────────────────────────

export const logsApi = {
  listAudit: (params?: {
    search?: string;
    user?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search)    q.set('search',    params.search);
    if (params?.user)      q.set('user',      params.user);
    if (params?.action)    q.set('action',    params.action);
    if (params?.from)      q.set('from',      params.from);
    if (params?.to)        q.set('to',        params.to);
    if (params?.page)      q.set('page',      String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<any>>(`/logs/audit?${q}`);
  },
  listAuth: (params?: { search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.search)    q.set('search',    params.search);
    if (params?.page)      q.set('page',      String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return get<PaginatedResponse<any>>(`/logs/auth?${q}`);
  },
};
