import { Database } from "bun:sqlite";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

interface Migration {
  id: string;
  up: (db: Database) => void;
  down: (db: Database) => void;
}

export class MigrationRunner {
  private db: Database;
  private migrationsPath: string;

  constructor(db: Database, migrationsPath: string = "./src/db/migrations") {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `);
  }

  private async loadMigrations(): Promise<Map<string, Migration>> {
    const files = await readdir(this.migrationsPath);
    const migrationFiles = files
      .filter(f => f.endsWith('.ts') && !f.includes('index'))
      .sort(); // Lexicographic sort

    const migrations = new Map<string, Migration>();

    for (const file of migrationFiles) {
      const path = join(this.migrationsPath, file);
      const migration = await import(path);
      const id = file.replace('.ts', '');
      
      if (!migration.up || !migration.down) {
        throw new Error(`Migration ${file} must export 'up' and 'down' functions`);
      }

      migrations.set(id, {
        id,
        up: migration.up,
        down: migration.down,
      });
    }

    return migrations;
  }

  private getAppliedMigrations(): Set<string> {
    const query = this.db.query("SELECT id FROM _migrations ORDER BY id");
    const rows = query.all() as { id: string }[];
    return new Set(rows.map(r => r.id));
  }

  async up(target?: string) {
    const migrations = await this.loadMigrations();
    const applied = this.getAppliedMigrations();
    const pending = Array.from(migrations.entries())
      .filter(([id]) => !applied.has(id))
      .filter(([id]) => !target || id <= target);

    if (pending.length === 0) {
      console.log("✓ No pending migrations");
      return;
    }

    for (const [id, migration] of pending) {
      console.log(`↑ Applying ${id}...`);
      
      this.db.transaction(() => {
        migration.up(this.db);
        this.db.run(
          "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
          [id, Date.now()]
        );
      })();

      console.log(`✓ Applied ${id}`);
    }
  }

  async down(steps: number = 1) {
    const applied = Array.from(this.getAppliedMigrations()).sort().reverse();
    const migrations = await this.loadMigrations();
    const toRollback = applied.slice(0, steps);

    if (toRollback.length === 0) {
      console.log("✓ No migrations to rollback");
      return;
    }

    for (const id of toRollback) {
      const migration = migrations.get(id);
      if (!migration) {
        throw new Error(`Migration ${id} not found but is marked as applied`);
      }

      console.log(`↓ Rolling back ${id}...`);
      
      this.db.transaction(() => {
        migration.down(this.db);
        this.db.run("DELETE FROM _migrations WHERE id = ?", [id]);
      })();

      console.log(`✓ Rolled back ${id}`);
    }
  }

  async status() {
    const migrations = await this.loadMigrations();
    const applied = this.getAppliedMigrations();

    console.log("\nMigration Status:");
    console.log("=================");
    
    for (const [id] of migrations) {
      const status = applied.has(id) ? "✓ applied" : "○ pending";
      console.log(`${status} ${id}`);
    }
  }

  async reset() {
    const applied = Array.from(this.getAppliedMigrations()).sort().reverse();
    if (applied.length > 0) {
      console.log("Rolling back all migrations...");
      await this.down(applied.length);
    }
    console.log("Running all migrations...");
    await this.up();
  }
}