import { homedir } from 'os';
import { join } from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  notesDir: process.env.NOTES_DIR || join(homedir(), '.slipbox-dev'),
  defaultPageSize: 10,
  minPageSize: 5,
  maxPageSize: 50,
  searchDebounceMs: 300,
  maxPreviewLength: 100
};