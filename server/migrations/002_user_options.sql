-- 002_user_options.sql
ALTER TABLE sys_users ADD COLUMN password_expires_at TIMESTAMP NULL;
ALTER TABLE sys_users ADD COLUMN one_time_password BOOLEAN DEFAULT FALSE;
ALTER TABLE sys_users ADD COLUMN require_otp BOOLEAN DEFAULT FALSE;
ALTER TABLE sys_users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sys_users ADD COLUMN password_history TEXT DEFAULT '[]';
