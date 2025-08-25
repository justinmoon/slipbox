import { readFileSync } from "fs" with { type: "macro" };

// These run at compile time when using bun build --compile
// Must use static paths for macros
export const EMBEDDED_MIGRATIONS: Record<string, string> = {
  // SQL files
  '0000_marvelous_elektra.sql': readFileSync('/Users/justin/code/slipbox/src/db/migrations/0000_marvelous_elektra.sql', 'utf-8'),
  '0001_nice_young_avengers.sql': readFileSync('/Users/justin/code/slipbox/src/db/migrations/0001_nice_young_avengers.sql', 'utf-8'),
  '0002_remove_tigris.sql': readFileSync('/Users/justin/code/slipbox/src/db/migrations/0002_remove_tigris.sql', 'utf-8'),
  
  // Meta files
  'meta/_journal.json': readFileSync('/Users/justin/code/slipbox/src/db/migrations/meta/_journal.json', 'utf-8'),
  'meta/0000_snapshot.json': readFileSync('/Users/justin/code/slipbox/src/db/migrations/meta/0000_snapshot.json', 'utf-8'),
  'meta/0001_snapshot.json': readFileSync('/Users/justin/code/slipbox/src/db/migrations/meta/0001_snapshot.json', 'utf-8'),
};