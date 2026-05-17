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
