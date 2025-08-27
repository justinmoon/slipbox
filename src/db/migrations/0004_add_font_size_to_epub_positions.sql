-- Add font_size column to epub_reading_positions table
ALTER TABLE epub_reading_positions ADD COLUMN font_size INTEGER NOT NULL DEFAULT 100;