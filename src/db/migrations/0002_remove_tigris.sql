-- Remove tigris columns and add fileKey column
ALTER TABLE files ADD COLUMN file_key TEXT;

-- Copy data from tigris_key to file_key
UPDATE files SET file_key = tigris_key WHERE tigris_key IS NOT NULL;

-- Make file_key NOT NULL after copying data
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
CREATE TABLE files_new (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  file_key TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note_id TEXT REFERENCES notes(id) ON DELETE SET NULL
);

-- Copy data to new table
INSERT INTO files_new (id, original_name, mime_type, size, file_key, uploaded_at, note_id)
SELECT id, original_name, mime_type, size, 
       COALESCE(file_key, tigris_key), 
       uploaded_at, note_id
FROM files;

-- Drop old table and rename new one
DROP TABLE files;
ALTER TABLE files_new RENAME TO files;

-- Recreate indexes
CREATE INDEX files_note_id_idx ON files(note_id);
CREATE INDEX files_uploaded_at_idx ON files(uploaded_at);