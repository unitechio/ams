CREATE TABLE IF NOT EXISTS sys_security_policies (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  policy_type TEXT NOT NULL DEFAULT 'auth',
  scope_type TEXT NOT NULL DEFAULT 'global',
  target_client TEXT DEFAULT '',
  target_channel TEXT DEFAULT '',
  priority INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT TRUE,
  config_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
