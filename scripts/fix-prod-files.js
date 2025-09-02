#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import path from "node:path";

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error(
    "Usage: bun scripts/fix-prod-files.js <db-path> <source-files-dir> <target-storage-dir>",
  );
  console.error(
    "Example: bun scripts/fix-prod-files.js ~/apps/slipbox/data/slipbox.db ~/slipbox ~/apps/slipbox/data",
  );
  console.error("");
  console.error("This script will:");
  console.error("1. Update file_key values in the database to match {id}.{extension} format");
  console.error("2. Copy actual files from source directory to target storage with correct naming");
  process.exit(1);
}

const [dbPath, sourceDir, targetStorageDir] = args;

// Validate inputs
try {
  await fs.stat(dbPath);
} catch {
  console.error(`Error: Database not found at ${dbPath}`);
  process.exit(1);
}

try {
  const stat = await fs.stat(sourceDir);
  if (!stat.isDirectory()) {
    console.error(`Error: ${sourceDir} is not a directory`);
    process.exit(1);
  }
} catch {
  console.error(`Error: Cannot access source directory ${sourceDir}`);
  process.exit(1);
}

// Create target storage directory if needed
await fs.mkdir(targetStorageDir, { recursive: true });

console.log(`📁 Database: ${dbPath}`);
console.log(`📂 Source files: ${sourceDir}`);
console.log(`💾 Target storage: ${targetStorageDir}`);
console.log("");

// Open database
const db = new Database(dbPath);

// Get all files from database
const files = db.prepare("SELECT * FROM files").all();
console.log(`Found ${files.length} files in database`);
console.log("");

let fixedCount = 0;
let copiedCount = 0;
let errorCount = 0;

for (const file of files) {
  const extension = path.extname(file.original_name);
  const expectedFileKey = `${file.id}${extension}`;

  console.log(`Processing: ${file.original_name}`);
  console.log(`  ID: ${file.id}`);
  console.log(`  Current file_key: ${file.file_key}`);
  console.log(`  Expected file_key: ${expectedFileKey}`);

  // Update file_key if needed
  if (file.file_key !== expectedFileKey) {
    db.prepare("UPDATE files SET file_key = ? WHERE id = ?").run(expectedFileKey, file.id);
    console.log(`  ✅ Updated file_key to: ${expectedFileKey}`);
    fixedCount++;
  }

  // Try to find and copy the actual file
  const targetPath = path.join(targetStorageDir, expectedFileKey);

  // Check if file already exists at target
  try {
    await fs.stat(targetPath);
    console.log(`  ℹ️  File already exists at target`);
  } catch {
    // File doesn't exist at target, try to copy from source
    const possibleSourcePaths = [
      path.join(sourceDir, file.original_name),
      path.join(sourceDir, file.file_key), // In case it was stored with old key
      path.join(sourceDir, file.id), // In case it was stored with just ID
      path.join(sourceDir, `${file.id}${extension}`), // In case it was stored with new format
    ];

    let copied = false;
    for (const sourcePath of possibleSourcePaths) {
      try {
        await fs.stat(sourcePath);
        // Found the file, copy it
        await fs.copyFile(sourcePath, targetPath);
        console.log(`  ✅ Copied from: ${sourcePath}`);
        copiedCount++;
        copied = true;
        break;
      } catch {
        // Try next path
      }
    }

    if (!copied) {
      console.log(`  ❌ File not found in source directory`);
      errorCount++;
    }
  }

  console.log("");
}

// Close database
db.close();

console.log("=== Migration Complete ===");
console.log(`📝 File keys fixed: ${fixedCount}`);
console.log(`📁 Files copied: ${copiedCount}`);
console.log(`❌ Files not found: ${errorCount}`);
console.log("");

if (errorCount > 0) {
  console.log("⚠️  Some files could not be found. They may need to be re-uploaded.");
} else {
  console.log("✅ Migration successful!");
}
