#!/bin/bash

# Script to reset the development data directory
# Creates a fresh database from the files found in ~/slipbox
#
# This approach is cleaner than trying to fix mismatched data:
# - Copies the notes database (for note content)
# - Copies EPUB files and creates fresh database entries for them
# - Ensures consistency between files on disk and database entries

SOURCE_DIR="$HOME/slipbox"
DEST_DIR="$HOME/.slipbox-dev"

echo "=== Resetting Development Data Directory ==="
echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory $SOURCE_DIR does not exist"
    exit 1
fi

# Step 1: Remove the old destination directory completely
echo "1. Removing old development directory..."
rm -rf "$DEST_DIR"

# Step 2: Create fresh destination directory structure
echo "2. Creating fresh directory structure..."
mkdir -p "$DEST_DIR"
mkdir -p "$DEST_DIR/files"

# Step 3: Copy and prepare the database
if [ -f "$SOURCE_DIR/slipbox.db" ]; then
    echo "3. Preparing database..."
    
    # Checkpoint the WAL to ensure all data is in the main database file
    sqlite3 "$SOURCE_DIR/slipbox.db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null
    
    # Copy the database file
    cp "$SOURCE_DIR/slipbox.db" "$DEST_DIR/slipbox.db"
    
    # Migrate schema if needed
    echo "   Checking and migrating database schema..."
    
    # Check if we need to rename tigris_key to file_key
    HAS_TIGRIS=$(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM pragma_table_info('files') WHERE name='tigris_key';" 2>/dev/null || echo "0")
    if [ "$HAS_TIGRIS" = "1" ]; then
        echo "   Migrating from tigris_key to file_key..."
        sqlite3 "$DEST_DIR/slipbox.db" "
            BEGIN TRANSACTION;
            ALTER TABLE files RENAME COLUMN tigris_key TO file_key;
            COMMIT;
        " 2>/dev/null
    fi
    
    # Check if tigris_bucket column exists and drop it
    HAS_BUCKET=$(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM pragma_table_info('files') WHERE name='tigris_bucket';" 2>/dev/null || echo "0")
    if [ "$HAS_BUCKET" = "1" ]; then
        echo "   Removing tigris_bucket column..."
        sqlite3 "$DEST_DIR/slipbox.db" "
            BEGIN TRANSACTION;
            CREATE TABLE files_new (
                id TEXT PRIMARY KEY,
                original_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                file_key TEXT NOT NULL,
                uploaded_at INTEGER DEFAULT CURRENT_TIMESTAMP NOT NULL,
                note_id TEXT,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
            );
            INSERT INTO files_new SELECT id, original_name, mime_type, size, file_key, uploaded_at, note_id FROM files;
            DROP TABLE files;
            ALTER TABLE files_new RENAME TO files;
            CREATE INDEX files_note_id_idx ON files(note_id);
            CREATE INDEX files_uploaded_at_idx ON files(uploaded_at);
            COMMIT;
        " 2>/dev/null
    fi
    
    # Clear the files table - we'll rebuild it from actual files
    echo "   Clearing old file entries..."
    sqlite3 "$DEST_DIR/slipbox.db" "DELETE FROM files;" 2>/dev/null
    
    NOTE_COUNT=$(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM notes;" 2>/dev/null || echo "0")
    echo "   Database ready with $NOTE_COUNT notes"
else
    echo "3. No database file found - creating new one..."
    # Create a minimal database structure
    sqlite3 "$DEST_DIR/slipbox.db" "
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created INTEGER NOT NULL,
            modified INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            file_key TEXT NOT NULL,
            uploaded_at INTEGER DEFAULT CURRENT_TIMESTAMP NOT NULL,
            note_id TEXT,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
        );
        
        CREATE INDEX IF NOT EXISTS files_note_id_idx ON files(note_id);
        CREATE INDEX IF NOT EXISTS files_uploaded_at_idx ON files(uploaded_at);
    " 2>/dev/null
fi

# Step 4: Copy EPUB files and create database entries
echo "4. Copying EPUB files and creating database entries..."

EPUB_COUNT=0
for file in "$SOURCE_DIR"/*.epub; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Extract UUID from filename (assuming format: uuid.epub)
        file_id="${filename%.epub}"
        
        # Copy the file
        cp "$file" "$DEST_DIR/files/$filename"
        
        # Get file size
        file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        
        # Create a nice display name (remove UUID format, use filename as is)
        display_name="Book_${EPUB_COUNT}"
        
        # Insert into database
        sqlite3 "$DEST_DIR/slipbox.db" "
            INSERT INTO files (id, original_name, mime_type, size, file_key, uploaded_at)
            VALUES ('$file_id', '$filename', 'application/epub+zip', $file_size, '$filename', datetime('now'));
        " 2>/dev/null
        
        EPUB_COUNT=$((EPUB_COUNT + 1))
        
        # Show progress every 10 files
        if [ $((EPUB_COUNT % 10)) -eq 0 ]; then
            echo "   Processed $EPUB_COUNT EPUB files..."
        fi
    fi
done

echo "   EPUB files copied and registered: $EPUB_COUNT"

# Step 5: Copy .md files to support notes if needed
echo "5. Copying markdown files..."

MD_COUNT=0
for file in "$SOURCE_DIR"/*.md; do
    if [ -f "$file" ]; then
        cp "$file" "$DEST_DIR/"
        MD_COUNT=$((MD_COUNT + 1))
        
        # Show progress every 500 files
        if [ $((MD_COUNT % 500)) -eq 0 ]; then
            echo "   Copied $MD_COUNT markdown files..."
        fi
    fi
done

echo "   Markdown files copied: $MD_COUNT"

# Step 6: Verify the setup
echo "6. Verifying setup..."

# Count files in destination
EPUB_COUNT_DEST=$(find "$DEST_DIR/files" -name "*.epub" -type f 2>/dev/null | wc -l | tr -d ' ')
MD_COUNT_DEST=$(find "$DEST_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
DB_EPUB_COUNT=$(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM files WHERE original_name LIKE '%.epub';" 2>/dev/null || echo "0")
DB_NOTE_COUNT=$(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM notes;" 2>/dev/null || echo "0")

echo ""
echo "=== Summary ==="
echo "Database:"
echo "  - Notes: $DB_NOTE_COUNT"
echo "  - EPUB entries: $DB_EPUB_COUNT"
echo ""
echo "Files on disk:"
echo "  - EPUBs in files/: $EPUB_COUNT_DEST"
echo "  - Markdown files: $MD_COUNT_DEST"

# Calculate directory sizes
SOURCE_SIZE=$(du -sh "$SOURCE_DIR" 2>/dev/null | cut -f1)
DEST_SIZE=$(du -sh "$DEST_DIR" 2>/dev/null | cut -f1)
echo ""
echo "Directory size: $SOURCE_SIZE → $DEST_SIZE"

if [ "$DB_EPUB_COUNT" = "$EPUB_COUNT_DEST" ] && [ -f "$DEST_DIR/slipbox.db" ]; then
    echo ""
    echo "✅ Success! Development data directory has been reset."
    echo "   Database and files are in sync."
    echo "   $EPUB_COUNT_DEST EPUB files are ready to read."
else
    echo ""
    echo "⚠️  Warning: File count mismatch!"
    echo "   Database has $DB_EPUB_COUNT EPUB entries"
    echo "   Directory has $EPUB_COUNT_DEST EPUB files"
fi

echo ""
echo "You can now run 'npm run dev' to start the development server."