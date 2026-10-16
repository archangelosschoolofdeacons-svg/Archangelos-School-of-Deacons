ALTER TABLE resources ADD COLUMN status TEXT NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published'));
ALTER TABLE resources ADD COLUMN tags TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN published_at TEXT NOT NULL DEFAULT '';
ALTER TABLE resources ADD COLUMN thumbnail_url TEXT NOT NULL DEFAULT '';
ALTER TABLE upload_sessions ADD COLUMN file_name TEXT NOT NULL DEFAULT '';

UPDATE resources SET created_at = updated_at WHERE created_at = '';
UPDATE resources SET published_at = updated_at WHERE status = 'published' AND published_at = '';

CREATE INDEX IF NOT EXISTS resources_status_updated_idx ON resources(status, updated_at DESC);
