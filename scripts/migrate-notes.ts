#!/usr/bin/env bun

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { db } from '../src/db/index';
import { notes, noteSearchIndex } from '../src/db/schema';
import { config } from '../src/config';

async function migrateNotes() {
  console.log('Starting migration of notes from file system to SQLite...');
  
  const notesDir = config.notesDir;
  let migratedCount = 0;
  let errorCount = 0;
  
  try {
    const files = await readdir(notesDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    console.log(`Found ${mdFiles.length} markdown files to migrate`);
    
    for (const file of mdFiles) {
      try {
        const id = file; // Keep the .md extension
        const path = join(notesDir, file);
        const content = await readFile(path, 'utf-8');
        const stats = await stat(path);
        
        // Extract title from content
        const lines = content.trim().split('\n');
        const firstLine = lines[0] || '';
        const titleMatch = firstLine.match(/^#+\s+(.+)/);
        const title = titleMatch ? titleMatch[1] : firstLine.slice(0, 50);
        
        // Generate preview
        const preview = content
          .replace(/^#+\s+/gm, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/[*_~`]/g, '')
          .replace(/\n+/g, ' ')
          .trim()
          .substring(0, 150);
        
        // Count words
        const wordCount = content
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 0).length;
        
        // Insert into database
        await db.insert(notes).values({
          id,
          title,
          content,
          preview: preview.length > 150 ? preview + '...' : preview,
          wordCount,
          charCount: content.length,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        }).onConflictDoNothing();
        
        // Insert into search index
        await db.insert(noteSearchIndex).values({
          id,
          content: `${title} ${content}`.toLowerCase(),
        }).onConflictDoNothing();
        
        migratedCount++;
        console.log(`Migrated: ${file}`);
      } catch (error) {
        console.error(`Error migrating ${file}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\nMigration completed!`);
    console.log(`Successfully migrated: ${migratedCount} notes`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateNotes();