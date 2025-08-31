#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { join } from "node:path";
import { MigrationRunner } from "./migration-runner";

// Get database path
const getDbPath = () => {
  if (!process.env.SLIPBOX_DATA_DIR) {
    // For migration CLI, use a default dev path if not set
    const devPath = join(process.cwd(), "data", "slipbox.db");
    console.log(`Using development database at: ${devPath}`);
    return devPath;
  }
  return join(process.env.SLIPBOX_DATA_DIR, "slipbox.db");
};

// CLI
if (import.meta.main) {
  const [command, ...args] = Bun.argv.slice(2);
  const dbPath = getDbPath();
  
  // Ensure directory exists
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  
  const db = new Database(dbPath);
  
  // Set pragmas
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  
  const runner = new MigrationRunner(db, join(import.meta.dir, "migrations"));

  try {
    switch (command) {
      case "up":
        await runner.up(args[0]);
        break;
      
      case "down":
        const steps = args[0] ? parseInt(args[0], 10) : 1;
        await runner.down(steps);
        break;
      
      case "status":
        await runner.status();
        break;
        
      case "reset":
        await runner.reset();
        break;
      
      default:
        console.log(`
Slipbox Migration Tool

Usage:
  bun run src/db/migrations.ts up [target]    # Run pending migrations (or up to target)
  bun run src/db/migrations.ts down [steps]   # Rollback migrations (default: 1)
  bun run src/db/migrations.ts status         # Show migration status
  bun run src/db/migrations.ts reset          # Rollback all, then run all migrations

Examples:
  bun run src/db/migrations.ts up             # Run all pending migrations
  bun run src/db/migrations.ts up 002_users   # Run up to 002_users migration
  bun run src/db/migrations.ts down           # Rollback last migration
  bun run src/db/migrations.ts down 3         # Rollback last 3 migrations
        `.trim());
    }
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

export { MigrationRunner };