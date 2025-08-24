export interface Note {
  id: string;
  content: string;
  created: Date;
  modified: Date;
  html?: string;
}

export interface NoteMetadata {
  id: string;
  content: string;
  created: Date;
  modified: Date;
}

export interface SearchResult {
  id: string;
  content: string;
  matchCount: number;
}