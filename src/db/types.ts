// Type definitions for database tables

export interface Note {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  wordCount: number;
  charCount: number;
}

export interface NewNote {
  id?: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
  wordCount?: number;
  charCount?: number;
}

export interface NoteSearchIndex {
  id: string;
  content: string;
}

// Files are now stored directly in the filesystem - no database table

export interface EpubReadingPosition {
  id: string;
  filename: string; // Just a filename, no FK - e.g., "8506b4fd-79f1-455a-8b57-be859b17defa.epub"
  cfi: string;
  percentage: number;
  fontSize: number;
  updatedAt: Date;
}

export interface NewEpubReadingPosition {
  id?: string;
  filename: string;
  cfi: string;
  percentage?: number;
  fontSize?: number;
  updatedAt?: Date;
}
