import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs/promises';

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

const runMigrations = async () => {
  try {
    // Always use absolute path since we're bundling
    const migrationsPath = '/app/dist/db/migrations';
    
    console.log('Running migrations from:', migrationsPath);
    console.log('Current working directory:', process.cwd());
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    await migrate(db, { migrationsFolder: migrationsPath });
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    // Continue without throwing in production
    console.log('WARNING: Migrations failed, continuing anyway...');
  }
};

await runMigrations();

export * from './schema';