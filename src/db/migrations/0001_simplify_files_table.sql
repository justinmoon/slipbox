-- Migration: Simplify files table to use filename as primary key
-- This removes unnecessary columns and makes the schema simpler

-- Create new simplified files table
CREATE TABLE files_new (
  filename TEXT PRIMARY KEY,  -- e.g., "8506b4fd-79f1-455a-8b57-be859b17defa.epub"
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table, using file_key as filename
INSERT INTO files_new (filename, mime_type, size, uploaded_at)
SELECT 
  COALESCE(file_key, id || '.epub') as filename,  -- Use file_key or construct from id
  mime_type,
  size,
  uploaded_at
FROM files;

-- Update epub_reading_positions to use filename instead of file_id
CREATE TABLE epub_reading_positions_new (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL REFERENCES files_new(filename) ON DELETE CASCADE,
  cfi TEXT NOT NULL,
  percentage INTEGER NOT NULL DEFAULT 0,
  font_size INTEGER NOT NULL DEFAULT 100,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate reading positions data
INSERT INTO epub_reading_positions_new (id, filename, cfi, percentage, font_size, updated_at)
SELECT 
  erp.id,
  COALESCE(f.file_key, f.id || '.epub') as filename,
  erp.cfi,
  erp.percentage,
  erp.font_size,
  erp.updated_at
FROM epub_reading_positions erp
JOIN files f ON erp.file_id = f.id;

-- Drop old tables
DROP TABLE epub_reading_positions;
DROP TABLE files;

-- Rename new tables
ALTER TABLE files_new RENAME TO files;
ALTER TABLE epub_reading_positions_new RENAME TO epub_reading_positions;

-- Create indexes
CREATE INDEX files_uploaded_at_idx ON files(uploaded_at);
CREATE INDEX epub_reading_positions_filename_idx ON epub_reading_positions(filename);
CREATE INDEX epub_reading_positions_updated_at_idx ON epub_reading_positions(updated_at);