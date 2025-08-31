import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

// Files are now stored directly in the filesystem - no database table needed

export const epubReadingPositions = sqliteTable(
  "epub_reading_positions",
  {
    id: text("id").primaryKey(),
    filename: text("filename").notNull(), // Just a filename, no FK - e.g., "8506b4fd-79f1-455a-8b57-be859b17defa.epub"
    cfi: text("cfi").notNull(), // EPUB CFI (Canonical Fragment Identifier) for precise position
    percentage: integer("percentage").notNull().default(0), // Reading percentage (0-100)
    fontSize: integer("font_size").notNull().default(100), // Font size percentage (50-200)
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    filenameIdx: index("epub_reading_positions_filename_idx").on(table.filename),
    updatedAtIdx: index("epub_reading_positions_updated_at_idx").on(table.updatedAt),
  }),
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type EpubReadingPosition = typeof epubReadingPositions.$inferSelect;
export type NewEpubReadingPosition = typeof epubReadingPositions.$inferInsert;
