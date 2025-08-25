#!/bin/bash

# Script to reset the development data directory
# Copies the database from ~/slipbox to ~/.slipbox-dev
#
# Why this script exists:
# - SQLite databases in WAL (Write-Ahead Log) mode keep recent changes in a separate
#   .db-wal file for performance. Simply copying the .db file can lose data.
# - This script properly checkpoints the WAL before copying to ensure all data
#   is consolidated in the main database file.
#
# What gets copied:
# - The SQLite database (with proper WAL checkpoint)
# - Other files EXCEPT .md and .zip files (for faster copying)
# - The database contains all note content, so .md files aren't needed

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

# Step 2: Create fresh destination directory
echo "2. Creating fresh directory..."
mkdir -p "$DEST_DIR"

# Step 3: Handle the database file specially if it exists
if [ -f "$SOURCE_DIR/slipbox.db" ]; then
    echo "3. Handling SQLite database with WAL checkpoint..."
    
    # Checkpoint the WAL to ensure all data is in the main database file
    # This prevents data loss when copying databases in WAL mode
    sqlite3 "$SOURCE_DIR/slipbox.db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null
    
    # Copy the database file
    cp "$SOURCE_DIR/slipbox.db" "$DEST_DIR/slipbox.db"
    
    # Verify the database copy
    if [ -f "$DEST_DIR/slipbox.db" ]; then
        SOURCE_COUNT=$(sqlite3 "$SOURCE_DIR/slipbox.db" "SELECT COUNT(*) FROM notes;" 2>/dev/null || echo "0")
        DEST_COUNT=$(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM notes;" 2>/dev/null || echo "0")
        echo "   Database: $SOURCE_COUNT notes → $DEST_COUNT notes"
    fi
else
    echo "3. No database file found in source directory"
fi

# Step 4: Copy select files (skipping .md and .zip files for faster dev setup)
echo "4. Copying select files (skipping .md and .zip files)..."

# Count files being copied and skipped
FILE_COUNT=0
SKIP_COUNT=0

# Copy all files except database-related ones, .md, and .zip files
for file in "$SOURCE_DIR"/*; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        
        # Skip database WAL and SHM files (they'll be recreated if needed)
        if [[ "$filename" == *.db-wal ]] || [[ "$filename" == *.db-shm ]]; then
            continue
        fi
        
        # Skip the main .db file as we already handled it
        if [[ "$filename" == slipbox.db ]]; then
            continue
        fi
        
        # Skip .md and .zip files for faster copying
        if [[ "$filename" == *.md ]] || [[ "$filename" == *.zip ]]; then
            SKIP_COUNT=$((SKIP_COUNT + 1))
            continue
        fi
        
        # Copy the file
        cp "$file" "$DEST_DIR/"
        FILE_COUNT=$((FILE_COUNT + 1))
        
        # Show progress every 100 files
        if [ $((FILE_COUNT % 100)) -eq 0 ]; then
            echo "   Copied $FILE_COUNT files..."
        fi
    fi
done

echo "   Files copied: $FILE_COUNT"
echo "   Files skipped (.md, .zip): $SKIP_COUNT"

# Step 5: Verify the copy
echo "5. Verifying copy..."

# Count different file types in source
MD_COUNT_SOURCE=$(find "$SOURCE_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ZIP_COUNT_SOURCE=$(find "$SOURCE_DIR" -maxdepth 1 -name "*.zip" -type f 2>/dev/null | wc -l | tr -d ' ')
OTHER_COUNT_SOURCE=$(find "$SOURCE_DIR" -maxdepth 1 -type f ! -name "*.md" ! -name "*.zip" ! -name "*.db*" 2>/dev/null | wc -l | tr -d ' ')

# Count files in destination
TOTAL_DEST=$(find "$DEST_DIR" -maxdepth 1 -type f ! -name "*.db-wal" ! -name "*.db-shm" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "=== Summary ==="
echo "Source directory:"
echo "  - Markdown files (.md): $MD_COUNT_SOURCE (skipped)"
echo "  - Zip files (.zip): $ZIP_COUNT_SOURCE (skipped)"
echo "  - Other files: $OTHER_COUNT_SOURCE (copied)"
echo ""
echo "Destination directory:"
echo "  - Total files: $TOTAL_DEST"
echo "  - Database notes: $(sqlite3 "$DEST_DIR/slipbox.db" "SELECT COUNT(*) FROM notes;" 2>/dev/null || echo "N/A")"

# Calculate directory sizes
SOURCE_SIZE=$(du -sh "$SOURCE_DIR" 2>/dev/null | cut -f1)
DEST_SIZE=$(du -sh "$DEST_DIR" 2>/dev/null | cut -f1)
echo ""
echo "Directory size: $SOURCE_SIZE → $DEST_SIZE"

if [ -f "$DEST_DIR/slipbox.db" ]; then
    echo ""
    echo "✅ Success! Development data directory has been reset."
    echo "   Database is ready with all notes indexed."
    echo "   Markdown and zip files were skipped for faster setup."
else
    echo ""
    echo "⚠️  Warning: Database file not found in destination."
fi

echo ""
echo "You can now run 'bun run dev' to start the development server with fresh data."