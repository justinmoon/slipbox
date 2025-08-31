import path from "node:path";
import { db } from "./database";
import { MigrationRunner } from "./migration-runner";

// Run migrations using new system
const runner = new MigrationRunner(db, path.join(import.meta.dir, "migrations"));
await runner.up();

// Export everything needed
export { all, db, exec, get, run, transaction } from "./database";
export * from "./types";
