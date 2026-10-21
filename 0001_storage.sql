CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  grade_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('audio', 'video', 'pdf', 'image')),
  url TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  tags TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  file_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS resources_updated_at_idx ON resources(updated_at DESC);
CREATE INDEX IF NOT EXISTS resources_file_key_idx ON resources(file_key);

CREATE TABLE IF NOT EXISTS media_objects (
  object_key TEXT PRIMARY KEY,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage_usage (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK (stored_bytes >= 0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0)
);

INSERT OR IGNORE INTO storage_usage(id, stored_bytes, reserved_bytes) VALUES(1, 0, 0);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  r2_upload_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  username TEXT NOT NULL,
  expected_bytes INTEGER NOT NULL CHECK (expected_bytes > 0),
  part_bytes INTEGER NOT NULL CHECK (part_bytes > 0),
  content_type TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('audio', 'video', 'pdf', 'image')),
  metadata_json TEXT NOT NULL,
  old_updated_at TEXT NOT NULL DEFAULT '',
  reserved_bytes INTEGER NOT NULL CHECK (reserved_bytes >= 0),
  parts_json TEXT NOT NULL DEFAULT '[]',
  file_name TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS upload_sessions_expiry_idx ON upload_sessions(expires_at);
