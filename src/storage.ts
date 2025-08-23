import { readFile, writeFile, unlink, readdir, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import { Note, NoteMetadata, SearchResult } from './types.js';
import { config } from './config.js';

export class NoteStorage {
  private notesDir: string;

  constructor() {
    this.notesDir = config.notesDir;
    this.ensureNotesDir();
  }

  private async ensureNotesDir(): Promise<void> {
    try {
      await stat(this.notesDir);
    } catch {
      await mkdir(this.notesDir, { recursive: true });
    }
  }

  private getNotePath(id: string): string {
    return join(this.notesDir, `${id}.md`);
  }

  extractTitle(content: string): string {
    const lines = content.split('\n');
    if (lines.length === 0) return 'Untitled';
    
    let firstLine = lines[0].trim();
    if (firstLine.startsWith('#')) {
      firstLine = firstLine.replace(/^#+\s*/, '');
    }
    
    return firstLine || 'Untitled';
  }

  private createPreview(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    const previewLines = lines.slice(0, 3).join(' ');
    return previewLines.length > config.maxPreviewLength 
      ? previewLines.substring(0, config.maxPreviewLength) + '...'
      : previewLines;
  }

  async createNote(content: string = ''): Promise<Note> {
    const id = uuidv4();
    const now = new Date();
    const note: Note = {
      id,
      content,
      created: now,
      modified: now
    };

    await writeFile(this.getNotePath(id), content, 'utf-8');
    return note;
  }

  async getNote(id: string): Promise<Note | null> {
    try {
      const path = this.getNotePath(id);
      const content = await readFile(path, 'utf-8');
      const stats = await stat(path);
      
      return {
        id,
        content,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch {
      return null;
    }
  }

  async updateNote(id: string, content: string): Promise<Note | null> {
    const notePath = this.getNotePath(id);
    try {
      const stats = await stat(notePath);
      await writeFile(notePath, content, 'utf-8');
      
      return {
        id,
        content,
        created: stats.birthtime,
        modified: new Date()
      };
    } catch {
      return null;
    }
  }

  async deleteNote(id: string): Promise<boolean> {
    try {
      await unlink(this.getNotePath(id));
      return true;
    } catch {
      return false;
    }
  }

  async listNotes(page: number = 1, pageSize: number = config.defaultPageSize): Promise<{
    notes: NoteMetadata[];
    totalPages: number;
    currentPage: number;
  }> {
    const files = await readdir(this.notesDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const notesWithStats = await Promise.all(
      mdFiles.map(async (file) => {
        const id = file.replace('.md', '');
        const path = join(this.notesDir, file);
        const content = await readFile(path, 'utf-8');
        const stats = await stat(path);
        
        return {
          id,
          title: this.extractTitle(content),
          preview: this.createPreview(content),
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );

    // Sort by modified date, newest first
    notesWithStats.sort((a, b) => b.modified.getTime() - a.modified.getTime());

    const totalPages = Math.ceil(notesWithStats.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const notes = notesWithStats.slice(startIndex, startIndex + pageSize);

    return {
      notes,
      totalPages,
      currentPage: page
    };
  }

  async searchNotes(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const files = await readdir(this.notesDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const lowerQuery = query.toLowerCase();
    
    const results = await Promise.all(
      mdFiles.map(async (file) => {
        const id = file.replace('.md', '');
        const path = join(this.notesDir, file);
        const content = await readFile(path, 'utf-8');
        const lowerContent = content.toLowerCase();
        
        const matchCount = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length;
        
        if (matchCount > 0) {
          return {
            id,
            title: this.extractTitle(content),
            preview: this.createPreview(content),
            matchCount
          };
        }
        
        return null;
      })
    );

    return results
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.matchCount - a.matchCount);
  }

  renderMarkdown(content: string): string {
    return marked(content, {
      gfm: true,
      breaks: true
    }) as string;
  }
}