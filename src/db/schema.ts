import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    wordCount: integer("word_count").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),
  },
  (table) => ({
    updatedAtIdx: index("notes_updated_at_idx").on(table.updatedAt),
    createdAtIdx: index("notes_created_at_idx").on(table.createdAt),
  }),
);

export const noteSearchIndex = sqliteTable("note_search_index", {
  id: text("id")
    .primaryKey()
    .references(() => notes.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
});

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    fileKey: text("file_key").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
  },
  (table) => ({
    noteIdIdx: index("files_note_id_idx").on(table.noteId),
    uploadedAtIdx: index("files_uploaded_at_idx").on(table.uploadedAt),
  }),
);

export const epubReadingPositions = sqliteTable(
  "epub_reading_positions",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    cfi: text("cfi").notNull(), // EPUB CFI (Canonical Fragment Identifier) for precise position
    percentage: integer("percentage").notNull().default(0), // Reading percentage (0-100)
    fontSize: integer("font_size").notNull().default(100), // Font size percentage (50-200)
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    fileIdIdx: index("epub_reading_positions_file_id_idx").on(table.fileId),
    updatedAtIdx: index("epub_reading_positions_updated_at_idx").on(table.updatedAt),
  }),
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type EpubReadingPosition = typeof epubReadingPositions.$inferSelect;
export type NewEpubReadingPosition = typeof epubReadingPositions.$inferInsert;
