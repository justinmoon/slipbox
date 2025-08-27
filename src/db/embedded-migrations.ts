import { readFileSync } from "fs" with { type: "macro" };

// These run at compile time when using bun build --compile
// Must use relative paths from project root for macros
export const EMBEDDED_MIGRATIONS: Record<string, string> = {
  // SQL files
  '0000_initial_schema.sql': readFileSync('./src/db/migrations/0000_initial_schema.sql', 'utf-8'),
  
  // Meta files
  'meta/_journal.json': readFileSync('./src/db/migrations/meta/_journal.json', 'utf-8'),
  'meta/0000_snapshot.json': readFileSync('./src/db/migrations/meta/0000_snapshot.json', 'utf-8'),
};