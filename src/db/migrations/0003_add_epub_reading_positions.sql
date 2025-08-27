-- Create epub_reading_positions table
CREATE TABLE epub_reading_positions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  cfi TEXT NOT NULL,
  percentage INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for epub_reading_positions
CREATE INDEX epub_reading_positions_file_id_idx ON epub_reading_positions(file_id);
CREATE INDEX epub_reading_positions_updated_at_idx ON epub_reading_positions(updated_at);