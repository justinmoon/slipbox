# SQLite and Tigris Migration Guide

This document describes the migration from file-based storage to SQLite (for notes) and Tigris S3-compatible storage (for other files).

## What Changed

### Before
- Notes (.md files) stored in the file system
- No support for file attachments
- Limited search capabilities
- No relational data

### After
- Notes stored in SQLite database with full-text search
- File attachments stored in Tigris object storage
- Better performance and scalability
- Support for metadata and relationships

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Tigris S3-compatible storage configuration
TIGRIS_ENDPOINT=https://fly.storage.tigris.dev
TIGRIS_ACCESS_KEY_ID=your_access_key_id_here
TIGRIS_SECRET_ACCESS_KEY=your_secret_access_key_here
TIGRIS_BUCKET_NAME=slipbox-files
```

### 2. Create Tigris Bucket

Create a bucket in your Tigris account with the name specified in `TIGRIS_BUCKET_NAME`.

### 3. Run Database Migrations

The database will be automatically created and migrated when you start the server:

```bash
bun run dev
```

### 4. Migrate Existing Notes

If you have existing notes in the file system, run the migration script:

```bash
bun scripts/migrate-notes.ts
```

This will:
- Read all .md files from your notes directory
- Import them into the SQLite database with the .md extension as part of the ID
- Preserve creation and modification timestamps
- Create search indexes
- Keep the same IDs (e.g., `abc123.md`) so links between notes continue to work

## New Features

### File Uploads

You can now attach files to notes using the API:

```bash
# Upload a file
curl -X POST http://localhost:3000/api/files/upload \
  -F "file=@document.pdf" \
  -F "noteId=<note-id>"

# Download a file
curl http://localhost:3000/api/files/<file-id>

# Get a signed URL for a file
curl http://localhost:3000/api/files/<file-id>/url

# Delete a file
curl -X DELETE http://localhost:3000/api/files/<file-id>
```

### Database Schema

The SQLite database includes:

- `notes` table: Stores note content and metadata
- `note_search_index` table: Full-text search index
- `files` table: Tracks files stored in Tigris

## Troubleshooting

### Database Location

By default, the database is stored at `~/.slipbox-dev/slipbox.db`. You can change this with the `DATABASE_PATH` environment variable.

### Tigris Connection Issues

If you get connection errors:
1. Verify your access credentials
2. Check that the bucket exists
3. Ensure your network allows HTTPS connections to the Tigris endpoint

### Migration Errors

If the migration script fails:
1. Check that your notes directory exists and contains .md files
2. Ensure the database is writable
3. Check the console for specific error messages

## Rollback

To rollback to file-based storage:
1. Keep the original storage.ts implementation
2. Remove the database file
3. Notes will still be in the file system if migration was run