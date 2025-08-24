export interface Note {
  id: string;
  content: string;
  created: Date;
  modified: Date;
  html?: string;
}

export interface NoteMetadata {
  id: string;
  preview: string;
  created: Date;
  modified: Date;
}

export interface SearchResult {
  id: string;
  preview: string;
  matchCount: number;
}