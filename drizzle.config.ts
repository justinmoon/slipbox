import type { Config } from 'drizzle-kit';
import path from 'path';
import { homedir } from 'os';

// ALWAYS require SLIPBOX_DATA_DIR
const getDbPath = () => {
  if (!process.env.SLIPBOX_DATA_DIR) {
    throw new Error('SLIPBOX_DATA_DIR environment variable is required. Run scripts/init.sh to set up.');
  }
  return path.join(process.env.SLIPBOX_DATA_DIR, 'slipbox.db');
};

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDbPath(),
  },
} satisfies Config;