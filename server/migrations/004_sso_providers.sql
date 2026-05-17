CREATE TABLE IF NOT EXISTS sys_sso_providers (
  id BIGSERIAL PRIMARY KEY,
  provider_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'oidc',
  client_id VARCHAR(255) DEFAULT '',
  client_secret VARCHAR(255) DEFAULT '',
  authorize_url VARCHAR(500) DEFAULT '',
  token_url VARCHAR(500) DEFAULT '',
  user_info_url VARCHAR(500) DEFAULT '',
  redirect_uri VARCHAR(500) DEFAULT '',
  scope VARCHAR(500) DEFAULT '',
  saml_login_url VARCHAR(500) DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allow_auto_provision BOOLEAN NOT NULL DEFAULT TRUE,
  icon VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
