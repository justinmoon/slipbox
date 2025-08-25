#!/bin/bash

# Script to safely copy SQLite database with WAL mode
# Usage: ./copy-db-safely.sh source.db destination.db

SOURCE_DB="$1"
DEST_DB="$2"

if [ -z "$SOURCE_DB" ] || [ -z "$DEST_DB" ]; then
    echo "Usage: $0 source.db destination.db"
    exit 1
fi

if [ ! -f "$SOURCE_DB" ]; then
    echo "Error: Source database $SOURCE_DB does not exist"
    exit 1
fi

echo "Safely copying database from $SOURCE_DB to $DEST_DB"

# First, checkpoint the WAL to ensure all data is in the main database file
echo "1. Checkpointing WAL..."
sqlite3 "$SOURCE_DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null

# Remove any existing destination WAL files
echo "2. Cleaning destination..."
rm -f "${DEST_DB}" "${DEST_DB}-wal" "${DEST_DB}-shm"

# Copy the database
echo "3. Copying database..."
cp "$SOURCE_DB" "$DEST_DB"

# Verify the copy
echo "4. Verifying..."
SOURCE_COUNT=$(sqlite3 "$SOURCE_DB" "SELECT COUNT(*) FROM notes;" 2>/dev/null)
DEST_COUNT=$(sqlite3 "$DEST_DB" "SELECT COUNT(*) FROM notes;" 2>/dev/null)

if [ "$SOURCE_COUNT" = "$DEST_COUNT" ]; then
    echo "✅ Success! Database copied with $DEST_COUNT notes."
else
    echo "❌ Error! Source has $SOURCE_COUNT notes but destination has $DEST_COUNT notes."
    exit 1
fi