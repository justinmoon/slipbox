# Slipbox - Datastar Edition

A Zettelkasten-style note-taking app built with Datastar framework and Bun.

Now with self-hosted CI/CD on Hetzner!

## Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)

## Installation

```bash
bun install
```

## Development

Run the development server with auto-reload:

```bash
bun run dev
```

The app will be available at http://localhost:3000

## Build

To build for production:

```bash
bun run build
```

## Production

Run the production build:

```bash
bun run start
```

## Features

- Create, edit, and delete notes
- Real-time search across all notes
- Markdown support with syntax highlighting
- Auto-save drafts to localStorage
- Newspaper-inspired aesthetic
- Keyboard shortcuts (Ctrl/Cmd+S to save, Escape to close search)
- Responsive design

## Environment Variables

- `PORT` - Server port (default: 3000)
- `SLIPBOX_DATA_DIR` - Data directory for database and files (default: ~/.slipbox-dev in development, required in production)
- `NODE_ENV` - Environment mode (development or production)

## Tech Stack

- **Frontend**: Datastar framework (hypermedia-first, reactive)
- **Backend**: Bun with TypeScript
- **Storage**: SQLite database with filesystem storage for attachments
- **Styling**: Custom newspaper-style CSS
- **Testing**: Playwright for UI tests
