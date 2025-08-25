import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs/promises';
import { EMBEDDED_MIGRATIONS } from './embedded-migrations';

const dbPath = process.env.DATABASE_PATH || path.join(process.env.NOTES_DIR || path.join(process.env.HOME!, '.slipbox-dev'), 'slipbox.db');

await fs.mkdir(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

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
      console.log('Database already initialized, skipping migrations');
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
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
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
      const migrationsPath = path.join(import.meta.dir, 'migrations');
      console.log('Running file-based migrations from:', migrationsPath);
      await migrate(db, { migrationsFolder: migrationsPath });
      console.log('Database migrations completed');
    } catch (error) {
      console.error('File-based migration failed:', error);
      console.log('WARNING: Migrations failed, continuing anyway...');
    }
  }
};

await runMigrations();

export * from './schema';