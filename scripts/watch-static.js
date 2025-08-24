#!/usr/bin/env node
import { spawn } from 'child_process';

// Watch and compile static TypeScript files
const tscWatch = spawn('tsc', ['-p', 'tsconfig.static.json', '--watch'], {
  stdio: 'inherit'
});

process.on('SIGINT', () => {
  tscWatch.kill();
  process.exit();
});