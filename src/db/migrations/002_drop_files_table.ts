import type { Database } from "bun:sqlite";

export const name = "002_drop_files_table";

export function up(db: Database): void {
  // Drop the files table entirely - filesystem is the source of truth
  db.exec(`DROP TABLE IF EXISTS files`);

  // Update epub_reading_positions to use filename instead of file_id
  db.exec(`
    CREATE TABLE epub_reading_positions_new (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,  -- Just a filename, no FK
      cfi TEXT NOT NULL,
      percentage INTEGER NOT NULL DEFAULT 0,
      font_size INTEGER NOT NULL DEFAULT 100,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Migrate existing data if any
  db.exec(`
    INSERT INTO epub_reading_positions_new (id, filename, cfi, percentage, font_size, updated_at)
    SELECT 
      erp.id,
      COALESCE(f.file_key, f.id || '.epub', f.original_name, erp.file_id || '.epub') as filename,
      erp.cfi,
      erp.percentage,
      erp.font_size,
      erp.updated_at
    FROM epub_reading_positions erp
    LEFT JOIN files f ON erp.file_id = f.id
  `);

  // Drop old table and rename new one
  db.exec(`DROP TABLE epub_reading_positions`);
  db.exec(`ALTER TABLE epub_reading_positions_new RENAME TO epub_reading_positions`);

  // Create indexes
  db.exec(`CREATE INDEX epub_reading_positions_filename_idx ON epub_reading_positions(filename)`);
  db.exec(`CREATE INDEX epub_reading_positions_updated_at_idx ON epub_reading_positions(updated_at)`);
}

export function down(db: Database): void {
  // This migration is not reversible since we're dropping the files table
  throw new Error("This migration cannot be reversed - files table data would be lost");
}