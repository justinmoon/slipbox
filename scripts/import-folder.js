#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime-types";
import { nanoid } from "nanoid";

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: bun scripts/import-folder.js <source-folder> <output-db-path>");
  console.error("Example: bun scripts/import-folder.js ~/slipbox ~/Desktop/imported.db");
  process.exit(1);
}

const [sourceFolder, outputDbPath] = args;

// Validate source folder exists
try {
  const stat = await fs.stat(sourceFolder);
  if (!stat.isDirectory()) {
    console.error(`Error: ${sourceFolder} is not a directory`);
    process.exit(1);
  }
} catch (_error) {
  console.error(`Error: Cannot access source folder ${sourceFolder}`);
  process.exit(1);
}

// Create output directory if needed
const outputDir = path.dirname(outputDbPath);
await fs.mkdir(outputDir, { recursive: true });

console.log(`📁 Source folder: ${sourceFolder}`);
console.log(`💾 Output database: ${outputDbPath}`);
console.log("");

// Initialize database
const db = new Database(outputDbPath);

// Set pragmas for better performance
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA cache_size = -64000");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA temp_store = MEMORY");

// Read and apply migration
console.log("🗃️  Creating database schema...");
const migrationPath = path.join(import.meta.dir, "../src/db/migrations/0000_initial_schema.sql");
const migrationSql = await Bun.file(migrationPath).text();

// Apply migration statements
const statements = migrationSql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

for (const statement of statements) {
  db.exec(statement);
}

console.log("✅ Database schema created");
console.log("");

// Function to calculate word and character counts
function calculateCounts(content) {
  const words = content.match(/\S+/g) || [];
  return {
    wordCount: words.length,
    charCount: content.length,
  };
}

// Function to get mime type
function getMimeType(filePath) {
  const mimeType = mime.lookup(filePath);
  return mimeType || "application/octet-stream";
}

// Process files
const files = await fs.readdir(sourceFolder, { withFileTypes: true });
let notesCount = 0;
let filesCount = 0;
let skippedCount = 0;

console.log(`📂 Processing ${files.length} items...`);
console.log("");

for (const file of files) {
  if (!file.isFile()) {
    console.log(`⏭️  Skipping directory: ${file.name}`);
    skippedCount++;
    continue;
  }

  const filePath = path.join(sourceFolder, file.name);
  const ext = path.extname(file.name).toLowerCase();

  // Skip database files
  if (file.name.startsWith(".db") || ext === ".db" || ext === ".db-wal" || ext === ".db-shm") {
    console.log(`⏭️  Skipping database file: ${file.name}`);
    skippedCount++;
    continue;
  }

  // Skip hidden files
  if (file.name.startsWith(".")) {
    console.log(`⏭️  Skipping hidden file: ${file.name}`);
    skippedCount++;
    continue;
  }

  try {
    const stat = await fs.stat(filePath);

    if (ext === ".md") {
      // Process as note
      const content = await fs.readFile(filePath, "utf-8");
      const { wordCount, charCount } = calculateCounts(content);
      const noteId = nanoid();

      // Insert note
      db.prepare(`
        INSERT INTO notes (id, content, created_at, updated_at, word_count, char_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        noteId,
        content,
        Math.floor(stat.birthtime.getTime() / 1000),
        Math.floor(stat.mtime.getTime() / 1000),
        wordCount,
        charCount,
      );

      // Insert into search index
      db.prepare(`
        INSERT INTO note_search_index (id, content)
        VALUES (?, ?)
      `).run(noteId, content);

      console.log(`📝 Imported note: ${file.name} (${wordCount} words)`);
      notesCount++;
    } else {
      // Process as file
      const fileId = nanoid();
      const mimeType = getMimeType(filePath);

      db.prepare(`
        INSERT INTO files (id, original_name, mime_type, size, file_key, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        file.name,
        mimeType,
        stat.size,
        file.name, // Using filename as file_key since we're not copying files
        Math.floor(stat.mtime.getTime() / 1000),
      );

      console.log(
        `📎 Imported file: ${file.name} (${mimeType}, ${(stat.size / 1024).toFixed(1)} KB)`,
      );
      filesCount++;
    }
  } catch (error) {
    console.error(`❌ Error processing ${file.name}:`, error.message);
  }
}

// Close database
db.close();

console.log("");
console.log("=== Import Complete ===");
console.log(`📝 Notes imported: ${notesCount}`);
console.log(`📎 Files imported: ${filesCount}`);
console.log(`⏭️  Items skipped: ${skippedCount}`);
console.log(`💾 Database saved to: ${outputDbPath}`);
console.log("");
console.log("✅ Import successful!");
