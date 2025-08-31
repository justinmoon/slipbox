import { db } from "./database";
import { MigrationRunner } from "./migration-runner";

// Run migrations using new system
const runner = new MigrationRunner(db);
await runner.up();

// Export everything needed
export { all, db, exec, get, run, transaction } from "./database";
export * from "./types";
