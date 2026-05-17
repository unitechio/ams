CREATE TABLE IF NOT EXISTS sys_reference_options (
  id BIGSERIAL PRIMARY KEY,
  option_group VARCHAR(100) NOT NULL,
  value VARCHAR(150) NOT NULL,
  label VARCHAR(200) NOT NULL,
  description VARCHAR(600) NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_reference_options_group_value
  ON sys_reference_options (option_group, value);
