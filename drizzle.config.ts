import type { Config } from 'drizzle-kit';
import path from 'path';
import { homedir } from 'os';

// Use ~/.slipbox-dev in development, require SLIPBOX_DATA_DIR in production
const getDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SLIPBOX_DATA_DIR) {
      throw new Error('SLIPBOX_DATA_DIR environment variable is required in production');
    }
    return path.join(process.env.SLIPBOX_DATA_DIR, 'slipbox.db');
  }
  
  // Development: use SLIPBOX_DATA_DIR if set, otherwise ~/.slipbox-dev
  const dataDir = process.env.SLIPBOX_DATA_DIR || path.join(homedir(), '.slipbox-dev');
  return path.join(dataDir, 'slipbox.db');
};

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDbPath(),
  },
} satisfies Config;