import { sqliteNoteStorage } from './services/note-storage';
import { Note, NoteMetadata, SearchResult } from './types';
import { config } from './config';

export class NoteStorage {

  async createNote(content: string = ''): Promise<Note> {
    const dbNote = await sqliteNoteStorage.createNote(content);
    
    return {
      id: dbNote.id,
      content: dbNote.content,
      created: dbNote.createdAt,
      modified: dbNote.updatedAt
    };
  }

  async getNote(id: string): Promise<Note | null> {
    const dbNote = await sqliteNoteStorage.getNote(id);
    if (!dbNote) return null;
    
    return {
      id: dbNote.id,
      content: dbNote.content,
      created: dbNote.createdAt,
      modified: dbNote.updatedAt,
      html: dbNote.html || undefined
    };
  }

  async updateNote(id: string, content: string): Promise<Note | null> {
    const dbNote = await sqliteNoteStorage.updateNote(id, content);
    if (!dbNote) return null;
    
    return {
      id: dbNote.id,
      content: dbNote.content,
      created: dbNote.createdAt,
      modified: dbNote.updatedAt
    };
  }

  async deleteNote(id: string): Promise<boolean> {
    return await sqliteNoteStorage.deleteNote(id);
  }

  async listNotes(page: number = 1, pageSize: number = config.defaultPageSize): Promise<{
    notes: NoteMetadata[];
    totalPages: number;
    currentPage: number;
  }> {
    const offset = (page - 1) * pageSize;
    const { notes: dbNotes, total } = await sqliteNoteStorage.listNotes({
      limit: pageSize,
      offset
    });
    
    const notes: NoteMetadata[] = dbNotes.map(note => ({
      id: note.id,
      content: note.content,
      created: note.createdAt,
      modified: note.updatedAt
    }));

    const totalPages = Math.ceil(total / pageSize);

    return {
      notes,
      totalPages,
      currentPage: page
    };
  }

  async searchNotes(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const dbNotes = await sqliteNoteStorage.searchNotes(query, 20);
    
    return dbNotes.map(note => {
      const lowerContent = note.content.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const matchCount = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length;
      
      return {
        id: note.id,
        content: note.content,
        matchCount
      };
    });
  }

  async renderMarkdown(content: string): Promise<string> {
    return await sqliteNoteStorage.renderMarkdown(content);
  }
}