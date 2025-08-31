import type { Database } from "bun:sqlite";

export function up(db: Database) {
  // Create notes table
  db.exec(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at INTEGER DEFAULT CURRENT_TIMESTAMP NOT NULL,
      word_count INTEGER DEFAULT 0 NOT NULL,
      char_count INTEGER DEFAULT 0 NOT NULL
    )
  `);

  db.exec("CREATE INDEX notes_updated_at_idx ON notes (updated_at)");
  db.exec("CREATE INDEX notes_created_at_idx ON notes (created_at)");

  // Create files table
  db.exec(`
    CREATE TABLE files (
      id TEXT PRIMARY KEY NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_key TEXT NOT NULL,
      uploaded_at INTEGER DEFAULT CURRENT_TIMESTAMP NOT NULL,
      note_id TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE set null
    )
  `);

  db.exec("CREATE INDEX files_note_id_idx ON files (note_id)");
  db.exec("CREATE INDEX files_uploaded_at_idx ON files (uploaded_at)");

  // Create note_search_index table
  db.exec(`
    CREATE TABLE note_search_index (
      id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (id) REFERENCES notes(id) ON UPDATE no action ON DELETE cascade
    )
  `);

  // Create epub_reading_positions table
  db.exec(`
    CREATE TABLE epub_reading_positions (
      id TEXT PRIMARY KEY NOT NULL,
      file_id TEXT NOT NULL,
      cfi TEXT NOT NULL,
      percentage INTEGER DEFAULT 0 NOT NULL,
      font_size INTEGER DEFAULT 100 NOT NULL,
      updated_at INTEGER DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON UPDATE no action ON DELETE cascade
    )
  `);

  db.exec("CREATE INDEX epub_reading_positions_file_id_idx ON epub_reading_positions (file_id)");
  db.exec(
    "CREATE INDEX epub_reading_positions_updated_at_idx ON epub_reading_positions (updated_at)",
  );
}

export function down(db: Database) {
  // Drop tables in reverse order of dependencies
  db.exec("DROP TABLE IF EXISTS epub_reading_positions");
  db.exec("DROP TABLE IF EXISTS note_search_index");
  db.exec("DROP TABLE IF EXISTS files");
  db.exec("DROP TABLE IF EXISTS notes");
}
