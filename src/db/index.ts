import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs/promises';

const dbPath = process.env.DATABASE_PATH || path.join(process.env.NOTES_DIR || path.join(process.env.HOME!, '.slipbox-dev'), 'slipbox.db');

await fs.mkdir(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = -64000');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('temp_store = MEMORY');

export const db = drizzle(sqlite, { schema });

const runMigrations = async () => {
  try {
    await migrate(db, { migrationsFolder: path.join(import.meta.dir, 'migrations') });
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

await runMigrations();

export * from './schema';