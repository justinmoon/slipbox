import { homedir } from 'os';
import { join } from 'path';

// Get the data directory
const getDataDir = () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SLIPBOX_DATA_DIR) {
      throw new Error('SLIPBOX_DATA_DIR environment variable is required in production');
    }
    return process.env.SLIPBOX_DATA_DIR;
  }
  
  // Development: use SLIPBOX_DATA_DIR if set, otherwise ~/.slipbox-dev
  return process.env.SLIPBOX_DATA_DIR || join(homedir(), '.slipbox-dev');
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dataDir: getDataDir(),
  // Keep notesDir for backward compatibility with migration scripts
  notesDir: getDataDir(),
  defaultPageSize: 10,
  minPageSize: 5,
  maxPageSize: 50,
  searchDebounceMs: 300,
  maxPreviewLength: 100
};