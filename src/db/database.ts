import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import path from "node:path";

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

export const db = new Database(dbPath);

// Important: Ensure WAL mode checkpoints are handled properly
// This prevents data loss when copying databases
db.exec("PRAGMA wal_autocheckpoint = 1000"); // Checkpoint every 1000 pages

// Set pragmas for better performance
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA cache_size = -64000");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA temp_store = MEMORY");

// Helper functions for common operations
export function all<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function get<T = any>(sql: string, params: any[] = []): T | null {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | null;
}

export function run(sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

export function exec(sql: string): void {
  db.exec(sql);
}

// Transaction helper
export function transaction<T>(fn: () => T): T {
  const tx = db.transaction(fn);
  return tx();
}