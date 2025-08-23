import { ServerSentEventGenerator } from '@starfederation/datastar-sdk/web';
import { NoteStorage } from './storage.js';
import { config } from './config.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Templates
import { HomePage } from './templates/HomePage';
import { NotePage } from './templates/NotePage';
import { NewNotePage } from './templates/NewNotePage';
import { EditNotePage } from './templates/EditNotePage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = new NoteStorage();

// Helper to serve static files
async function serveStatic(path: string): Promise<Response> {
  const file = Bun.file(join(__dirname, '..', path));
  return new Response(file);
}

// Helper to create HTML response
function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Helper to create not found response
function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

// Main server
Bun.serve({
  port: config.port,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Static files
    if (path.startsWith('/static/')) {
      return serveStatic(path);
    }


    // Routes
    switch (path) {
      case '/':
        return handleHome(url);
      
      case '/search':
        return handleSearch(url);
      
      case '/new':
        return handleNewNote();
      
      case '/note/new':
        if (req.method === 'POST') {
          return handleCreateNote(req);
        }
        break;
    }

    // Dynamic routes
    const noteMatch = path.match(/^\/note\/([a-f0-9-]+)$/);
    if (noteMatch) {
      const id = noteMatch[1];
      if (req.method === 'GET') {
        return handleViewNote(id);
      } else if (req.method === 'POST') {
        return handleUpdateNote(req, id);
      } else if (req.method === 'DELETE') {
        return handleDeleteNote(id);
      }
    }

    const editMatch = path.match(/^\/edit\/([a-f0-9-]+)$/);
    if (editMatch) {
      return handleEditNote(editMatch[1]);
    }

    return notFound();
  }
});

// Route handlers
async function handleHome(url: URL): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || String(config.defaultPageSize)), config.minPageSize),
    config.maxPageSize
  );

  const { notes, totalPages, currentPage } = await storage.listNotes(page, pageSize);
  
  return htmlResponse(HomePage({ notes, totalPages, currentPage }));
}

async function handleSearch(url: URL): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  const results = await storage.searchNotes(query);

  return ServerSentEventGenerator.stream((stream) => {
    stream.patchSignals(JSON.stringify({ searchResults: results }));
  });
}

async function handleViewNote(id: string): Promise<Response> {
  const note = await storage.getNote(id);
  
  if (!note) {
    return notFound();
  }

  const title = storage.extractTitle(note.content);
  const html = storage.renderMarkdown(note.content);

  return htmlResponse(NotePage({ id, title, html }));
}

function handleNewNote(): Response {
  return htmlResponse(NewNotePage());
}

async function handleCreateNote(req: Request): Promise<Response> {
  const reader = await ServerSentEventGenerator.readSignals(req);
  
  if (!reader.success) {
    return new Response('Error reading signals', { status: 400 });
  }

  const content = reader.signals.content as string || '';
  const note = await storage.createNote(content);

  return ServerSentEventGenerator.stream((stream) => {
    stream.patchElements(`<meta http-equiv="refresh" content="0; url=/note/${note.id}">`);
  });
}

async function handleEditNote(id: string): Promise<Response> {
  const note = await storage.getNote(id);
  
  if (!note) {
    return notFound();
  }

  return htmlResponse(EditNotePage({ id, content: note.content }));
}

async function handleUpdateNote(req: Request, id: string): Promise<Response> {
  const reader = await ServerSentEventGenerator.readSignals(req);
  
  if (!reader.success) {
    return new Response('Error reading signals', { status: 400 });
  }

  const content = reader.signals.content as string || '';
  const note = await storage.updateNote(id, content);
  
  if (!note) {
    return notFound();
  }

  return ServerSentEventGenerator.stream((stream) => {
    stream.patchSignals(JSON.stringify({ saving: false }));
    stream.patchElements(`
      <div class="notification">Note saved!</div>
      <script>
        localStorage.removeItem('draft-${id}');
        setTimeout(() => document.querySelector('.notification')?.remove(), 2000);
      </script>
    `);
  });
}

async function handleDeleteNote(id: string): Promise<Response> {
  const success = await storage.deleteNote(id);
  
  if (!success) {
    return notFound();
  }

  return ServerSentEventGenerator.stream((stream) => {
    stream.patchElements(`<meta http-equiv="refresh" content="0; url=/">`);
  });
}

console.log(`Slipbox server running at http://localhost:${config.port}`);