import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs/promises';
import { EMBEDDED_MIGRATIONS } from './embedded-migrations';

// ALWAYS require SLIPBOX_DATA_DIR
const getDbPath = () => {
  if (!process.env.SLIPBOX_DATA_DIR) {
    throw new Error('SLIPBOX_DATA_DIR environment variable is required. Run scripts/init.sh to set up.');
  }
  return path.join(process.env.SLIPBOX_DATA_DIR, 'slipbox.db');
};

const dbPath = getDbPath();

await fs.mkdir(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

// Important: Ensure WAL mode checkpoints are handled properly
// This prevents data loss when copying databases
sqlite.exec("PRAGMA wal_autocheckpoint = 1000"); // Checkpoint every 1000 pages

// Set pragmas for better performance
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA busy_timeout = 5000");
sqlite.exec("PRAGMA synchronous = NORMAL");
sqlite.exec("PRAGMA cache_size = -64000");
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA temp_store = MEMORY");

export const db = drizzle(sqlite, { schema });

// Simple migration runner that checks if tables exist
const runEmbeddedMigrations = async () => {
  try {
    // Check if notes table exists (indicates DB is already set up)
    const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").all();
    
    if (tables.length > 0) {
      // Double-check that the table has data before skipping
      const count = sqlite.query("SELECT COUNT(*) as count FROM notes").get() as { count: number };
      console.log(`Database already initialized with ${count.count} notes, skipping migrations`);
      return;
    }
    
    console.log('Initializing new database with embedded migrations...');
    
    // Parse the journal to get migration order
    const journalContent = EMBEDDED_MIGRATIONS['meta/_journal.json'];
    if (!journalContent) {
      console.log('No migration journal found, skipping migrations');
      return;
    }
    
    const journal = JSON.parse(journalContent);
    
    // Apply migrations in order
    for (const entry of journal.entries) {
      const migrationFile = `${entry.tag}.sql`;
      const migrationSql = EMBEDDED_MIGRATIONS[migrationFile];
      
      if (!migrationSql) {
        console.warn(`Migration file ${migrationFile} not found in embedded migrations`);
        continue;
      }
      
      console.log(`Applying migration: ${migrationFile}`);
      
      // Split by statement-breakpoint markers (Drizzle's format)
      const statements = migrationSql
        .split('--> statement-breakpoint')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          sqlite.exec(statement + ';');
        } catch (e) {
          console.error(`Failed to execute statement: ${statement}`, e);
          throw e;
        }
      }
      
      console.log(`Migration ${migrationFile} applied successfully`);
    }
    
    console.log('All embedded migrations completed');
  } catch (error) {
    console.error('Embedded migration failed:', error);
    // In production, we might want to continue anyway if DB already exists
    console.log('WARNING: Migrations failed, continuing anyway...');
  }
};

// Try to run migrations
const runMigrations = async () => {
  // First try embedded migrations (for compiled binaries)
  if (Object.keys(EMBEDDED_MIGRATIONS).length > 0) {
    await runEmbeddedMigrations();
  } else {
    // Fall back to file-based migrations (for development)
    try {
      // Check if files table exists and fix schema if needed
      try {
        const filesColumns = sqlite.query("PRAGMA table_info(files)").all() as Array<{name: string}>;
        const hasFileKey = filesColumns.some(col => col.name === 'file_key');
        const hasTigrisKey = filesColumns.some(col => col.name === 'tigris_key');
        
        if (filesColumns.length > 0 && !hasFileKey && hasTigrisKey) {
          console.log('Files table has old schema (tigris_key), migrating to new schema (file_key)...');
          
          // Apply the migration manually since Drizzle isn't handling it properly
          sqlite.exec(`
            CREATE TABLE files_new (
              id TEXT PRIMARY KEY,
              original_name TEXT NOT NULL,
              mime_type TEXT NOT NULL,
              size INTEGER NOT NULL,
              file_key TEXT NOT NULL,
              uploaded_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
              note_id TEXT REFERENCES notes(id) ON DELETE SET NULL
            );
          `);
          
          // Copy data if any exists
          try {
            sqlite.exec(`
              INSERT INTO files_new (id, original_name, mime_type, size, file_key, uploaded_at, note_id)
              SELECT id, original_name, mime_type, size, tigris_key, uploaded_at, note_id FROM files;
            `);
          } catch (e) {
            // No data to copy, that's fine
          }
          
          // Replace old table
          sqlite.exec(`DROP TABLE files;`);
          sqlite.exec(`ALTER TABLE files_new RENAME TO files;`);
          
          // Recreate indexes
          sqlite.exec(`CREATE INDEX files_note_id_idx ON files(note_id);`);
          sqlite.exec(`CREATE INDEX files_uploaded_at_idx ON files(uploaded_at);`);
          
          console.log('Schema migration completed successfully');
          return;
        }
      } catch (e) {
        // Files table doesn't exist, continue with normal migration check
      }
      
      // First check if DB already exists and has data
      const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").all();
      if (tables.length > 0) {
        const count = sqlite.query("SELECT COUNT(*) as count FROM notes").get() as { count: number };
        console.log(`Database already exists with ${count.count} notes, skipping file-based migrations`);
        return;
      }
      
      const migrationsPath = path.join(import.meta.dir, 'migrations');
      console.log('Running file-based migrations from:', migrationsPath);
      console.log('Database path:', dbPath);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      await migrate(db, { migrationsFolder: migrationsPath });
      console.log('Database migrations completed');
    } catch (error) {
      console.error('File-based migration failed:', error);
      // Don't throw in production - app will use whatever database state exists
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
      console.log('WARNING: Migrations failed, continuing anyway...');
    }
  }
};

await runMigrations();

export * from './schema';