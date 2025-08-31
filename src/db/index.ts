import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import { join } from "path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

// ALWAYS require SLIPBOX_DATA_DIR
const getDbPath = () => {
  if (!process.env.SLIPBOX_DATA_DIR) {
    throw new Error(
      "SLIPBOX_DATA_DIR environment variable is required. Run scripts/init.sh to set up.",
    );
  }
  return path.join(process.env.SLIPBOX_DATA_DIR, "slipbox.db");
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

// Simple migration runner - works the same in dev and prod
const runMigrations = async () => {
  try {
    // Check if database is already initialized
    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
      .all();

    if (tables.length > 0) {
      const count = sqlite.query("SELECT COUNT(*) as count FROM notes").get() as { count: number };
      console.log(`Database already initialized with ${count.count} notes, skipping migrations`);
      return;
    }

    console.log("Initializing new database...");

    // Read migration file using Bun.file() - this gets embedded in production builds
    const migrationPath = join(import.meta.dir, "./migrations/0000_initial_schema.sql");
    const migrationSql = await Bun.file(migrationPath).text();

    // Apply the migration
    // Split by statement-breakpoint markers (Drizzle's format)
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      sqlite.exec(statement);
    }

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    // In production, continue anyway - app will use whatever database state exists
    if (process.env.NODE_ENV === "production") {
      console.log("WARNING: Migration failed in production, continuing anyway...");
    } else {
      throw error;
    }
  }
};

await runMigrations();

export * from "./schema";