-- ============================================================
-- AUTH SYSTEM - Database Migration
-- Enterprise RBAC + Permission + Scope Architecture
-- ============================================================

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email         TEXT UNIQUE,
    full_name     TEXT NOT NULL DEFAULT '',
    phone         TEXT DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active','inactive','locked')),
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until  DATETIME,
    last_login    DATETIME,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_users_username ON sys_users(username) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_users_email    ON sys_users(email)    WHERE deleted = false;

-- ─── Roles ───────────────────────────────────────────────────
-- Roles are GROUPING mechanisms only.
-- Authorization is NEVER done by role directly.
CREATE TABLE IF NOT EXISTS sys_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by  TEXT DEFAULT '',
    deleted     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON sys_roles(name) WHERE deleted = false;

-- ─── User → Role mapping ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys_user_roles (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES sys_users(id),
    role_id INTEGER NOT NULL REFERENCES sys_roles(id),
    deleted BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON sys_user_roles(user_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON sys_user_roles(role_id) WHERE deleted = false;

-- ─── Permission Definitions ───────────────────────────────────
-- Centralized permission registry persisted to DB.
-- Synced from Go constants on startup.
CREATE TABLE IF NOT EXISTS sys_permission_defs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,   -- e.g. "user.read"
    name        TEXT NOT NULL,          -- display name
    description TEXT DEFAULT '',
    group_name  TEXT NOT NULL DEFAULT '',  -- e.g. "user", "report"
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_perm_defs_code ON sys_permission_defs(code) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_perm_defs_group ON sys_permission_defs(group_name);

-- ─── Role → Permission mapping (with SCOPE) ───────────────────
-- This is the core of the authorization model.
-- Each role-permission pair has a SCOPE that controls data visibility.
CREATE TABLE IF NOT EXISTS sys_role_permissions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id       INTEGER NOT NULL REFERENCES sys_roles(id),
    permission_id INTEGER NOT NULL REFERENCES sys_permission_defs(id),
    -- scope controls DATA-LEVEL access:
    --   self         = only own data
    --   department   = department's data
    --   organization = organization-wide
    --   global       = no restriction (wildcard data)
    scope         TEXT NOT NULL DEFAULT 'self'
                    CHECK(scope IN ('self','department','organization','global')),
    deleted       BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_role ON sys_role_permissions(role_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON sys_role_permissions(permission_id) WHERE deleted = false;

-- ─── Permission Lines ─────────────────────────────────────────
-- Granular controller:action mappings within a permission
CREATE TABLE IF NOT EXISTS sys_permission_lines (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_id INTEGER NOT NULL REFERENCES sys_permission_defs(id),
    controller    TEXT NOT NULL,
    action        TEXT NOT NULL,
    note          TEXT DEFAULT '',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by    TEXT DEFAULT '',
    deleted       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_perm_lines_perm ON sys_permission_lines(permission_id) WHERE deleted = false;

-- ─── Menus ───────────────────────────────────────────────────
-- Menu visibility is driven by permission_code, NOT by role.
CREATE TABLE IF NOT EXISTS sys_menus (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    url             TEXT DEFAULT '#',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    icon            TEXT DEFAULT '',
    permission_code TEXT DEFAULT '',     -- "" = always visible (public menu)
                                         -- otherwise: must have this permission to see
    parent_id       INTEGER REFERENCES sys_menus(id),
    menu_type       TEXT NOT NULL DEFAULT 'main'
                    CHECK(menu_type IN ('main','sub','separator')),
    deleted         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_menus_parent    ON sys_menus(parent_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_menus_perm_code ON sys_menus(permission_code);

-- ─── Refresh Tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys_refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES sys_users(id),
    token      TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT false,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tokens_user   ON sys_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token  ON sys_refresh_tokens(token) WHERE revoked = false;

-- ─── Audit Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys_audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES sys_users(id),
    username    TEXT NOT NULL DEFAULT '',
    action      TEXT NOT NULL,      -- permission code used
    resource    TEXT NOT NULL DEFAULT '',
    resource_id TEXT DEFAULT '',
    ip_address  TEXT DEFAULT '',
    allowed     BOOLEAN NOT NULL DEFAULT true,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user      ON sys_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON sys_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON sys_audit_logs(created_at);
