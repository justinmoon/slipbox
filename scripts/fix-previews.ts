#!/usr/bin/env bun

import { db } from '../src/db/index';
import { notes } from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function fixPreviews() {
  console.log('Fixing note previews...');
  
  // Get all notes
  const allNotes = await db.select().from(notes);
  
  let fixedCount = 0;
  
  for (const note of allNotes) {
    const cleanPreview = note.content
      .replace(/^#+\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\n+/g, ' ')
      .trim();
    
    const finalPreview = cleanPreview.length > 150 
      ? cleanPreview.substring(0, 150).trim() + '...'
      : cleanPreview;
    
    if (finalPreview !== note.preview) {
      await db
        .update(notes)
        .set({ preview: finalPreview })
        .where(sql`id = ${note.id}`);
      
      fixedCount++;
      console.log(`Fixed preview for: ${note.id}`);
    }
  }
  
  console.log(`\nFixed ${fixedCount} previews`);
}

fixPreviews();