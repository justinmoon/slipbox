import { ServerSentEventGenerator } from '@starfederation/datastar-sdk/web';
import { NoteStorage } from './storage.js';
import { config } from './config.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
        return handleSearch(req, url);
      
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
  
  return htmlResponse(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slipbox</title>
  <link rel="stylesheet" href="/static/style.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-RC.5/bundles/datastar.min.js"></script>
</head>
<body>
  <div id="app" data-signals-search="''" data-signals-searchResults="[]" data-signals-showSearch="false">
    <header>
      <h1><a href="/">Slipbox</a></h1>
      <nav>
        <a href="/new">New Note</a>
        <button data-on-click="$showSearch = !$showSearch">Search</button>
      </nav>
    </header>

    <div id="search-container" data-show="$showSearch">
      <input 
        type="text" 
        placeholder="Search notes..." 
        data-bind="search"
        data-on-input.debounce_300ms="@get('/search?q=' + encodeURIComponent($search))"
        data-on-keydown.escape="$showSearch = false; $search = ''"
        autofocus
      />
      <div id="search-results" data-show="$searchResults.length > 0">
        <template data-for="result of $searchResults">
          <a data-attributes-href="'/note/' + $result.id" class="search-result">
            <h3 data-text="$result.title"></h3>
            <p data-text="$result.preview"></p>
          </a>
        </template>
      </div>
    </div>

    <main>
      <h2>All Notes</h2>
      <div class="notes-grid">
        ${notes.map(note => `
          <article class="note-card">
            <h3><a href="/note/${note.id}">${note.title}</a></h3>
            <p>${note.preview}</p>
            <time>${note.modified.toLocaleDateString()}</time>
          </article>
        `).join('')}
      </div>

      ${totalPages > 1 ? `
        <nav class="pagination">
          ${currentPage > 1 ? `<a href="/?page=${currentPage - 1}">Previous</a>` : ''}
          <span>Page ${currentPage} of ${totalPages}</span>
          ${currentPage < totalPages ? `<a href="/?page=${currentPage + 1}">Next</a>` : ''}
        </nav>
      ` : ''}
    </main>
  </div>
</body>
</html>
  `);
}

async function handleSearch(_req: Request, url: URL): Promise<Response> {
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

  return htmlResponse(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Slipbox</title>
  <link rel="stylesheet" href="/static/style.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-RC.5/bundles/datastar.min.js"></script>
</head>
<body>
  <div id="app">
    <header>
      <h1><a href="/">Slipbox</a></h1>
      <nav>
        <a href="/edit/${note.id}">Edit</a>
        <button data-on-click="if(confirm('Delete this note?')) @delete('/note/${note.id}')">Delete</button>
      </nav>
    </header>

    <main>
      <article class="note-content">
        ${html}
      </article>
    </main>
  </div>
</body>
</html>
  `);
}

function handleNewNote(): Response {
  return htmlResponse(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Note - Slipbox</title>
  <link rel="stylesheet" href="/static/style.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-RC.5/bundles/datastar.min.js"></script>
</head>
<body>
  <div id="app" data-signals-content="''" data-signals-saving="false">
    <header>
      <h1><a href="/">Slipbox</a></h1>
      <nav>
        <button data-on-click="@post('/note/new')" data-attributes-disabled="$saving">
          <span data-show="!$saving">Create</span>
          <span data-show="$saving">Creating...</span>
        </button>
        <a href="/">Cancel</a>
      </nav>
    </header>

    <main>
      <div class="editor">
        <textarea 
          data-bind="content"
          placeholder="Start writing..."
          data-on-keydown.ctrl.s.prevent="@post('/note/new')"
          data-on-keydown.meta.s.prevent="@post('/note/new')"
          autofocus
        ></textarea>
      </div>
    </main>
  </div>
</body>
</html>
  `);
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

  return htmlResponse(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Note - Slipbox</title>
  <link rel="stylesheet" href="/static/style.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/@starfederation/datastar@1.0.0-RC.5/bundles/datastar.min.js"></script>
</head>
<body>
  <div id="app" 
    data-signals-content="${note.content.replace(/"/g, '&quot;')}" 
    data-signals-saving="false"
    data-on-load="
      const draft = localStorage.getItem('draft-${note.id}');
      if (draft && draft !== $content && confirm('Restore unsaved draft?')) {
        $content = draft;
      }
    ">
    <header>
      <h1><a href="/">Slipbox</a></h1>
      <nav>
        <button data-on-click="@post('/note/${note.id}')" data-attributes-disabled="$saving">
          <span data-show="!$saving">Save</span>
          <span data-show="$saving">Saving...</span>
        </button>
        <a href="/note/${note.id}">Cancel</a>
      </nav>
    </header>

    <main>
      <div class="editor">
        <textarea 
          data-bind="content"
          data-on-keydown.ctrl.s.prevent="@post('/note/${note.id}')"
          data-on-keydown.meta.s.prevent="@post('/note/${note.id}')"
          data-effect="localStorage.setItem('draft-${note.id}', $content)"
          autofocus
        ></textarea>
      </div>
    </main>
  </div>
</body>
</html>
  `);
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