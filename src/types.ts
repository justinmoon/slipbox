export interface Note {
  id: string;
  content: string;
  created: Date;
  modified: Date;
}

export interface NoteMetadata {
  id: string;
  title: string;
  preview: string;
  created: Date;
  modified: Date;
}

export interface SearchResult {
  id: string;
  title: string;
  preview: string;
  matchCount: number;
}