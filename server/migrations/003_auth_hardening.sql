-- 003_auth_hardening.sql
ALTER TABLE sys_users ADD COLUMN allowed_clients TEXT DEFAULT '[]';
ALTER TABLE sys_users ADD COLUMN allowed_channels TEXT DEFAULT '[]';
ALTER TABLE sys_users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE sys_users ADD COLUMN email_otp_hash TEXT DEFAULT '';
ALTER TABLE sys_users ADD COLUMN email_otp_expires_at TIMESTAMP NULL;
ALTER TABLE sys_users ADD COLUMN email_verify_hash TEXT DEFAULT '';
ALTER TABLE sys_users ADD COLUMN email_verify_expiry TIMESTAMP NULL;
ALTER TABLE sys_users ADD COLUMN totp_secret TEXT DEFAULT '';
ALTER TABLE sys_users ADD COLUMN pending_totp_secret TEXT DEFAULT '';

ALTER TABLE sys_refresh_tokens ADD COLUMN session_id TEXT;
ALTER TABLE sys_refresh_tokens ADD COLUMN token_family TEXT;
ALTER TABLE sys_refresh_tokens ADD COLUMN client_id TEXT;
ALTER TABLE sys_refresh_tokens ADD COLUMN device_name TEXT DEFAULT '';
ALTER TABLE sys_refresh_tokens ADD COLUMN device_fingerprint TEXT DEFAULT '';
ALTER TABLE sys_refresh_tokens ADD COLUMN ip_address TEXT DEFAULT '';
ALTER TABLE sys_refresh_tokens ADD COLUMN user_agent TEXT DEFAULT '';
ALTER TABLE sys_refresh_tokens ADD COLUMN trusted BOOLEAN DEFAULT FALSE;
ALTER TABLE sys_refresh_tokens ADD COLUMN rotated_from TEXT DEFAULT '';
ALTER TABLE sys_refresh_tokens ADD COLUMN revoked_reason TEXT DEFAULT '';
ALTER TABLE sys_refresh_tokens ADD COLUMN last_used_at TIMESTAMP NULL;
ALTER TABLE sys_refresh_tokens ADD COLUMN reuse_detected_at TIMESTAMP NULL;
