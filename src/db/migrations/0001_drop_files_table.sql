-- Migration: Drop the files table entirely
-- We'll use the filesystem as the source of truth for files

-- First, update epub_reading_positions to remove the foreign key constraint
CREATE TABLE epub_reading_positions_new (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,  -- Just a filename, no FK - e.g., "8506b4fd-79f1-455a-8b57-be859b17defa.epub"
  cfi TEXT NOT NULL,
  percentage INTEGER NOT NULL DEFAULT 0,
  font_size INTEGER NOT NULL DEFAULT 100,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing data
INSERT INTO epub_reading_positions_new (id, filename, cfi, percentage, font_size, updated_at)
SELECT 
  erp.id,
  COALESCE(f.file_key, f.id || '.epub', f.original_name) as filename,
  erp.cfi,
  erp.percentage,
  erp.font_size,
  erp.updated_at
FROM epub_reading_positions erp
LEFT JOIN files f ON erp.file_id = f.id;

-- Drop old tables
DROP TABLE epub_reading_positions;
DROP TABLE files;

-- Rename new table
ALTER TABLE epub_reading_positions_new RENAME TO epub_reading_positions;

-- Create indexes
CREATE INDEX epub_reading_positions_filename_idx ON epub_reading_positions(filename);
CREATE INDEX epub_reading_positions_updated_at_idx ON epub_reading_positions(updated_at);