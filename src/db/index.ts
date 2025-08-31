import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { runMigrations } from "./migrate";
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

// Run migrations
await runMigrations(sqlite);

export * from "./schema";
