CREATE TABLE IF NOT EXISTS sys_auth_clients (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT DEFAULT '',
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  app_type TEXT NOT NULL DEFAULT 'web_app',
  public BOOLEAN DEFAULT TRUE,
  pkce_required BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  grant_types_json TEXT DEFAULT '[]',
  redirect_uris_json TEXT DEFAULT '[]',
  audiences_json TEXT DEFAULT '[]',
  channels_json TEXT DEFAULT '[]',
  trusted_types_json TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
