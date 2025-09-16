# Slipbox - Datastar Edition

A Zettelkasten-style note-taking app built with Datastar framework and Bun.

Now with self-hosted CI/CD on Hetzner!

## GitOps Deployment

This repo uses a GitOps flow:
- PRs build with `nix build .#server --impure --option sandbox false` and smoke test.
- PRs are auto-merged using a PAT available to the runner.
- Pushes to `master` open a PR in `justinmoon/configs` bumping Slipbox in `flake.lock`.
- After merge, Hetzner deploys via `nixos-rebuild switch` from the `configs` repo.

Runner PAT configuration:
- The self-hosted runner reads a GitHub PAT from `~/configs/secrets/github-pat.txt` on the server.
- You can rotate this any time; the workflow also supports the `GH_TOKEN` secret if defined.

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
# Test CI

.
