import type { Config } from 'drizzle-kit';
import path from 'path';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || path.join(process.env.NOTES_DIR || path.join(process.env.HOME!, '.slipbox-dev'), 'slipbox.db'),
  },
} satisfies Config;