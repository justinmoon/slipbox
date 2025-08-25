#!/usr/bin/env bun

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Create test data directory structure
const testDataDir = join(homedir(), '.slipbox-dev');
const filesDir = join(testDataDir, 'files');

console.log('Setting up test data...');

// Create directories
if (!existsSync(testDataDir)) {
  mkdirSync(testDataDir, { recursive: true });
  console.log('Created:', testDataDir);
}

if (!existsSync(filesDir)) {
  mkdirSync(filesDir, { recursive: true });
  console.log('Created:', filesDir);
}

// Create a minimal test database with some notes
// The app will initialize the database on first run, but we can pre-populate it
console.log('Test data directories created successfully');
console.log('The application will initialize the database on first run');