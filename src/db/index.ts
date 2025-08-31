import path from "node:path";
import { db } from "./database";
import { MigrationRunner } from "./migration-runner";

// Run migrations using new system
const runner = new MigrationRunner(db, path.join(import.meta.dir, "migrations"));
await runner.up();

// Export everything needed
export { db, all, get, run, exec, transaction } from "./database";
export * from "./types";