import { Database } from "bun:sqlite";
import { join } from "path";

export async function runMigrations(sqlite: Database): Promise<void> {
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
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

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
}
