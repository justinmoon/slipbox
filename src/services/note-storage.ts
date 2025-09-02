import { marked } from "marked";
import { v4 as uuidv4 } from "uuid";
import { all, get, run, transaction } from "../db/index";
import type { Note } from "../db/types";

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
    const now = new Date();

    return transaction(() => {
      run(
        `INSERT INTO notes (id, content, word_count, char_count, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, content, wordCount, charCount, now.getTime(), now.getTime()],
      );

      run(`INSERT INTO note_search_index (id, content) VALUES (?, ?)`, [id, content.toLowerCase()]);

      return {
        id,
        content,
        wordCount,
        charCount,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  async getNote(id: string): Promise<NoteWithHtml | null> {
    const note = get<Note>(
      `SELECT 
        id, 
        content, 
        created_at as createdAt, 
        updated_at as updatedAt, 
        word_count as wordCount, 
        char_count as charCount 
       FROM notes 
       WHERE id = ? 
       LIMIT 1`,
      [id],
    );

    if (!note) return null;

    // Convert timestamps to Date objects
    note.createdAt = new Date(note.createdAt);
    note.updatedAt = new Date(note.updatedAt);

    return {
      ...note,
      html: await marked(note.content),
    };
  }

  async updateNote(id: string, content: string): Promise<Note | null> {
    const wordCount = this.countWords(content);
    const charCount = content.length;
    const updatedAt = new Date();

    return transaction(() => {
      const result = run(
        `UPDATE notes 
         SET content = ?, word_count = ?, char_count = ?, updated_at = ? 
         WHERE id = ?`,
        [content, wordCount, charCount, updatedAt.getTime(), id],
      );

      if (result.changes === 0) return null;

      run(`UPDATE note_search_index SET content = ? WHERE id = ?`, [content.toLowerCase(), id]);

      const note = get<Note>(
        `SELECT 
          id, 
          content, 
          created_at as createdAt, 
          updated_at as updatedAt, 
          word_count as wordCount, 
          char_count as charCount 
         FROM notes 
         WHERE id = ? 
         LIMIT 1`,
        [id],
      );

      if (note) {
        note.createdAt = new Date(note.createdAt);
        note.updatedAt = new Date(note.updatedAt);
      }

      return note;
    });
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = run(`DELETE FROM notes WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  async listNotes({ limit = 10, offset = 0, search }: ListNotesOptions = {}): Promise<{
    notes: Note[];
    total: number;
    hasMore: boolean;
  }> {
    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`;

      const totalResult = get<{ count: number }>(
        `SELECT COUNT(*) as count FROM notes 
         WHERE id IN (
           SELECT id FROM note_search_index 
           WHERE content LIKE ?
         )`,
        [searchPattern],
      );
      const total = totalResult?.count || 0;

      const notesList = all<Note>(
        `SELECT 
          id, 
          content, 
          created_at as createdAt, 
          updated_at as updatedAt, 
          word_count as wordCount, 
          char_count as charCount 
         FROM notes 
         WHERE id IN (
           SELECT id FROM note_search_index 
           WHERE content LIKE ?
         )
         ORDER BY updated_at DESC 
         LIMIT ? OFFSET ?`,
        [searchPattern, limit, offset],
      );

      // Convert timestamps to Date objects
      notesList.forEach((note) => {
        note.createdAt = new Date(note.createdAt);
        note.updatedAt = new Date(note.updatedAt);
      });

      return {
        notes: notesList,
        total,
        hasMore: offset + notesList.length < total,
      };
    } else {
      const totalResult = get<{ count: number }>(`SELECT COUNT(*) as count FROM notes`);
      const total = totalResult?.count || 0;

      const notesList = all<Note>(
        `SELECT 
          id, 
          content, 
          created_at as createdAt, 
          updated_at as updatedAt, 
          word_count as wordCount, 
          char_count as charCount 
         FROM notes 
         ORDER BY updated_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset],
      );

      // Convert timestamps to Date objects
      notesList.forEach((note) => {
        note.createdAt = new Date(note.createdAt);
        note.updatedAt = new Date(note.updatedAt);
      });

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

    const notesList = all<Note>(
      `SELECT 
        id, 
        content, 
        created_at as createdAt, 
        updated_at as updatedAt, 
        word_count as wordCount, 
        char_count as charCount 
       FROM notes 
       WHERE id IN (
         SELECT id FROM note_search_index 
         WHERE content LIKE ?
       )
       ORDER BY updated_at DESC 
       LIMIT ?`,
      [searchPattern, limit],
    );

    // Convert timestamps to Date objects
    notesList.forEach((note) => {
      note.createdAt = new Date(note.createdAt);
      note.updatedAt = new Date(note.updatedAt);
    });

    return notesList;
  }

  async getTotalNotes(): Promise<number> {
    const result = get<{ count: number }>(`SELECT COUNT(*) as count FROM notes`);
    return result?.count || 0;
  }

  async getRecentNotes(limit: number = 5): Promise<Note[]> {
    const notesList = all<Note>(
      `SELECT 
        id, 
        content, 
        created_at as createdAt, 
        updated_at as updatedAt, 
        word_count as wordCount, 
        char_count as charCount 
       FROM notes 
       ORDER BY updated_at DESC 
       LIMIT ?`,
      [limit],
    );

    // Convert timestamps to Date objects
    notesList.forEach((note) => {
      note.createdAt = new Date(note.createdAt);
      note.updatedAt = new Date(note.updatedAt);
    });

    return notesList;
  }

  async renderMarkdown(content: string): Promise<string> {
    return await marked(content);
  }

  private countWords(content: string): number {
    return content
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}

export const sqliteNoteStorage = new SqliteNoteStorage();
