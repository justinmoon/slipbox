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

export interface File {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileKey: string;
  uploadedAt: Date;
  noteId: string | null;
}

export interface NewFile {
  id?: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileKey: string;
  uploadedAt?: Date;
  noteId?: string | null;
}

export interface EpubReadingPosition {
  id: string;
  fileId: string;
  cfi: string;
  percentage: number;
  fontSize: number;
  updatedAt: Date;
}

export interface NewEpubReadingPosition {
  id?: string;
  fileId: string;
  cfi: string;
  percentage?: number;
  fontSize?: number;
  updatedAt?: Date;
}
