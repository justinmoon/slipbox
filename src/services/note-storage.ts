import { db } from '../db/index';
import { notes, noteSearchIndex, Note } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';

export interface NoteWithHtml extends Note {
  html?: string;
}

export interface ListNotesOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export class SqliteNoteStorage {
  async createNote(content: string): Promise<Note> {
    const id = `${uuidv4()}.md`;
    const wordCount = this.countWords(content);
    const charCount = content.length;

    const [note] = await db.insert(notes).values({
      id,
      content,
      wordCount,
      charCount,
    }).returning();

    await db.insert(noteSearchIndex).values({
      id,
      content: content.toLowerCase(),
    });

    return note;
  }

  async getNote(id: string): Promise<NoteWithHtml | null> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    
    if (!note) return null;

    return {
      ...note,
      html: await marked(note.content),
    };
  }

  async updateNote(id: string, content: string): Promise<Note | null> {
    const wordCount = this.countWords(content);
    const charCount = content.length;
    const updatedAt = new Date();

    const [updatedNote] = await db
      .update(notes)
      .set({
        content,
        wordCount,
        charCount,
        updatedAt,
      })
      .where(eq(notes.id, id))
      .returning();

    if (!updatedNote) return null;

    await db
      .update(noteSearchIndex)
      .set({
        content: content.toLowerCase(),
      })
      .where(eq(noteSearchIndex.id, id));

    return updatedNote;
  }

  async deleteNote(id: string): Promise<boolean> {
    await db.delete(notes).where(eq(notes.id, id));
    return true;
  }

  async listNotes({ limit = 10, offset = 0, search }: ListNotesOptions = {}): Promise<{
    notes: Note[];
    total: number;
    hasMore: boolean;
  }> {
    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`;
      const searchCondition = sql`${notes.id} IN (
        SELECT id FROM ${noteSearchIndex} 
        WHERE ${noteSearchIndex.content} LIKE ${searchPattern}
      )`;
      
      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(searchCondition);
      
      const notesList = await db
        .select()
        .from(notes)
        .where(searchCondition)
        .orderBy(desc(notes.updatedAt))
        .limit(limit)
        .offset(offset);

      return {
        notes: notesList,
        total,
        hasMore: offset + notesList.length < total,
      };
    } else {
      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes);
      
      const notesList = await db
        .select()
        .from(notes)
        .orderBy(desc(notes.updatedAt))
        .limit(limit)
        .offset(offset);

      return {
        notes: notesList,
        total,
        hasMore: offset + notesList.length < total,
      };
    }
  }

  async searchNotes(searchTerm: string, limit: number = 10): Promise<Note[]> {
    if (!searchTerm.trim()) return [];

    const searchPattern = `%${searchTerm.toLowerCase()}%`;
    
    return await db
      .select()
      .from(notes)
      .where(
        sql`${notes.id} IN (
          SELECT id FROM ${noteSearchIndex} 
          WHERE ${noteSearchIndex.content} LIKE ${searchPattern}
        )`
      )
      .orderBy(desc(notes.updatedAt))
      .limit(limit);
  }

  async getTotalNotes(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes);
    
    return count;
  }

  async getRecentNotes(limit: number = 5): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .orderBy(desc(notes.updatedAt))
      .limit(limit);
  }

  async renderMarkdown(content: string): Promise<string> {
    // Create a new Marked instance to avoid conflicts
    const { Marked } = await import('marked');
    const markedInstance = new Marked();
    
    // Configure marked to handle epub:// links
    const renderer = {
      link(href: string | null | undefined, title: string | null | undefined, text: string): string | false {
        // Ensure href is a string
        const hrefStr = String(href || '');
        
        // Handle epub:// links specially
        if (hrefStr && hrefStr.startsWith('epub://')) {
          // Parse the epub link: epub://fileId#cfi
          const match = hrefStr.match(/^epub:\/\/([^#]+)#(.+)$/);
          if (match) {
            const [, fileId, cfi] = match;
            // Convert to a proper web URL
            const webUrl = `/epub/${fileId}#${cfi}`;
            // Escape the text to prevent XSS
            const escapedText = text.replace(/[&<>"']/g, (char) => {
              const escapes: Record<string, string> = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
              };
              return escapes[char] || char;
            });
            return `<a href="${webUrl}" class="epub-link" data-file-id="${fileId}" data-cfi="${cfi}">${escapedText}</a>`;
          }
        }
        // Return false to use the default renderer for other links
        return false;
      }
    };
    
    markedInstance.use({ renderer });
    return await markedInstance.parse(content);
  }

  private countWords(content: string): number {
    return content
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }
}

export const sqliteNoteStorage = new SqliteNoteStorage();