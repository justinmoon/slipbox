#!/usr/bin/env bun

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function fixImports(dir: string) {
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = join(dir, file.name);
    
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      await fixImports(fullPath);
    } else if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
      let content = await readFile(fullPath, 'utf-8');
      
      // Replace .js imports with no extension
      content = content.replace(/from\s+['"]([^'"]+)\.js['"]/g, "from '$1'");
      
      await writeFile(fullPath, content);
      console.log(`Fixed imports in: ${fullPath}`);
    }
  }
}

// Fix all imports in src directory
await fixImports('./src');
console.log('All imports fixed!');