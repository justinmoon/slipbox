import { ServerSentEventGenerator } from '@starfederation/datastar-sdk/web';
import { NoteStorage } from './storage';
import { config } from './config';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fileStorage } from './services/file-storage';

// Templates
import { HomePage } from './templates/HomePage';
import { NotePage } from './templates/NotePage';
import { NewNotePage } from './templates/NewNotePage';
import { EditNotePage } from './templates/EditNotePage';
import { ReaderPage } from './templates/ReaderPage';
import { EpubReaderPage } from './templates/EpubReaderPage';
import { UploadPage } from './templates/UploadPage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = new NoteStorage();

// Initialize storage services
await fileStorage.initialize();

interface EpubFile {
  id: string;
  name: string;
  size: number;
  modified: Date;
}

async function getEpubFiles(): Promise<EpubFile[]> {
  try {
    const { files } = await fileStorage.getAllFiles(100, 0);
    
    // Filter for EPUB files
    const epubFiles = files
      .filter(file => file.originalName.toLowerCase().endsWith('.epub'))
      .map(file => ({
        id: file.id,
        name: file.originalName.replace(/\.epub$/i, ''),
        size: file.size,
        modified: file.uploadedAt
      }));
    
    return epubFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } catch (error) {
    console.error("Error fetching EPUB files:", error);
    return [];
  }
}

// Helper to serve static files (for development)
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

    // Static files (only needed in development, production uses embedded CSS)
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
        
      case '/reader':
        return handleReader();
        
      case '/upload':
        return handleUpload();
    }

    // Dynamic routes
    const noteMatch = path.match(/^\/note\/([a-f0-9-]+\.md)$/);
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

    const editMatch = path.match(/^\/edit\/([a-f0-9-]+\.md)$/);
    if (editMatch) {
      return handleEditNote(editMatch[1]);
    }

    // Reader routes
    if (path.startsWith('/reader/book/')) {
      const bookName = decodeURIComponent(path.slice(13));
      console.log('Opening book:', bookName);
      return handleBookReader(bookName);
    }
    
    if (path.startsWith('/reader/open/')) {
      const fileId = decodeURIComponent(path.slice(13));
      console.log('Opening book:', fileId);
      return handleOpenBook(fileId);
    }

    // Serve EPUB files from Tigris
    if (path.startsWith('/epub/')) {
      const fileId = decodeURIComponent(path.slice(6));
      return handleServeEpub(req, fileId);
    }

    // File upload/download routes
    if (path === '/api/files/upload' && req.method === 'POST') {
      return handleFileUpload(req);
    }
    
    const fileMatch = path.match(/^\/api\/files\/([a-f0-9-]+)$/);
    if (fileMatch) {
      const fileId = fileMatch[1];
      if (req.method === 'GET') {
        return handleFileDownload(fileId);
      } else if (req.method === 'DELETE') {
        return handleFileDelete(fileId);
      }
    }
    
    const fileUrlMatch = path.match(/^\/api\/files\/([a-f0-9-]+)\/url$/);
    if (fileUrlMatch) {
      return handleGetFileUrl(fileUrlMatch[1]);
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
  
  return htmlResponse(HomePage({ notes, totalPages, currentPage }) as string);
}

async function handleSearch(url: URL): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  
  if (!query.trim()) {
    // Return to regular paginated view
    const { notes, totalPages, currentPage } = await storage.listNotes(1, config.defaultPageSize);
    return ServerSentEventGenerator.stream((stream) => {
      stream.patchElements(
        `<div id="notes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">
          ${notes.map(note => `
            <a href="/note/${note.id}" class="no-underline text-inherit block h-full">
              <article class="border-2 border-dark bg-off-white p-6 h-full flex flex-col justify-between hover:shadow-[3px_3px_0_#111] transition-shadow">
                <p class="text-base text-dark mb-2" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${note.content || '(empty note)'}</p>
                <time class="text-sm text-gray-600 italic">${note.modified.toLocaleDateString()}</time>
              </article>
            </a>
          `).join('')}
        </div>`,
        { selector: '#notes-grid' }
      );
    });
  }

  const results = await storage.searchNotes(query);
  
  return ServerSentEventGenerator.stream((stream) => {
    if (results.length === 0) {
      stream.patchElements(
        `<div id="notes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">
          <p class="col-span-full text-center italic text-gray-600 py-8">No notes found matching "${query}"</p>
        </div>`,
        { selector: '#notes-grid' }
      );
    } else {
      stream.patchElements(
        `<div id="notes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">
          ${results.map(result => `
            <a href="/note/${result.id}" class="no-underline text-inherit block h-full">
              <article class="border-2 border-dark bg-off-white p-6 h-full flex flex-col justify-between hover:shadow-[3px_3px_0_#111] transition-shadow">
                <p class="text-base text-dark mb-2" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${result.content}</p>
                <span class="text-sm text-gray-600 italic">${result.matchCount} match${result.matchCount !== 1 ? 'es' : ''}</span>
              </article>
            </a>
          `).join('')}
        </div>`,
        { selector: '#notes-grid' }
      );
    }
  });
}

async function handleViewNote(id: string): Promise<Response> {
  const note = await storage.getNote(id);
  
  if (!note) {
    return notFound();
  }

  const html = await storage.renderMarkdown(note.content);
  return htmlResponse(NotePage({ note, html }) as string);
}

function handleNewNote(): Response {
  return htmlResponse(NewNotePage() as string);
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

  return htmlResponse(EditNotePage({ id, content: note.content }) as string);
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
    stream.executeScript(`localStorage.removeItem('draft-${id}')`);
    stream.patchElements(`
      <div class="notification" data-on-load="setTimeout(() => $el.remove(), 2000)">Note saved!</div>
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

// Reader handlers
async function handleReader(): Promise<Response> {
  const epubFiles = await getEpubFiles();
  return htmlResponse(ReaderPage({ epubFiles }) as string);
}

async function handleBookReader(bookName: string): Promise<Response> {
  console.log('handleBookReader called for:', bookName);
  
  // Get file info from Tigris storage by name
  const { files } = await fileStorage.getAllFiles(100, 0);
  const file = files.find(f => f.originalName === `${bookName}.epub`);
  
  if (!file) {
    return notFound();
  }
  
  const bookUrl = `/epub/${encodeURIComponent(file.id)}`;
  return htmlResponse(EpubReaderPage({ bookName, bookUrl }) as string);
}

// Upload handler
function handleUpload(): Response {
  return htmlResponse(UploadPage() as string);
}

async function handleOpenBook(fileId: string): Promise<Response> {
  console.log('handleOpenBook called for:', fileId);
  return ServerSentEventGenerator.stream((stream) => {
    stream.executeScript(`
      console.log('Script executing for book:', '${fileId}');
      document.getElementById('library').classList.add('hidden');
      const readerDiv = document.getElementById('reader');
      readerDiv.classList.remove('hidden');
      
      // Create epub-reader element if it doesn't exist
      let epubReader = readerDiv.querySelector('epub-reader');
      if (!epubReader) {
        epubReader = document.createElement('epub-reader');
        readerDiv.appendChild(epubReader);
      }
      
      // Load the book
      epubReader.loadBook('/epub/${encodeURIComponent(fileId)}');
    `);
  });
}

async function handleServeEpub(req: Request, fileId: string): Promise<Response> {
  try {
    const fileInfo = await fileStorage.getFile(fileId);
    if (!fileInfo || !fileInfo.originalName.toLowerCase().endsWith('.epub')) {
      return notFound();
    }

    // Enable CORS for epub.js
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    };
    
    // Handle OPTIONS requests
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    
    // Handle range requests for epub.js
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      // For range requests, we need to download the file and serve the requested range
      const result = await fileStorage.downloadFile(fileId);
      if (!result) {
        return notFound();
      }
      
      const { buffer } = result;
      const fileSize = buffer.length;
      const range = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(range[0], 10);
      const end = range[1] ? parseInt(range[1], 10) : fileSize - 1;
      
      return new Response(buffer.slice(start, end + 1), {
        status: 206,
        headers: {
          ...headers,
          "Content-Type": "application/epub+zip",
          "Content-Length": (end - start + 1).toString(),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
        }
      });
    }
    
    // For regular requests, download and serve the full file
    const result = await fileStorage.downloadFile(fileId);
    if (!result) {
      return notFound();
    }
    
    return new Response(result.buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `inline; filename="${fileInfo.originalName}"`,
        "Accept-Ranges": "bytes",
      }
    });
  } catch (error) {
    console.error('Error serving EPUB:', error);
    return new Response('Error serving file', { status: 500 });
  }
}

// File upload/download handlers
async function handleFileUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as unknown as File;
    const noteId = formData.get('noteId') as string | null;
    
    if (!file) {
      return new Response('No file provided', { status: 400 });
    }
    
    const savedFile = await fileStorage.uploadFile(
      file,
      file.name,
      file.type || 'application/octet-stream',
      { noteId: noteId || undefined }
    );
    
    return new Response(JSON.stringify(savedFile), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('File upload error:', error);
    return new Response('Upload failed', { status: 500 });
  }
}

async function handleFileDownload(fileId: string): Promise<Response> {
  try {
    const result = await fileStorage.downloadFile(fileId);
    if (!result) {
      return notFound();
    }
    
    return new Response(result.buffer, {
      headers: {
        'Content-Type': result.file.mimeType,
        'Content-Disposition': `attachment; filename="${result.file.originalName}"`,
        'Content-Length': result.file.size.toString()
      }
    });
  } catch (error) {
    console.error('File download error:', error);
    return new Response('Download failed', { status: 500 });
  }
}

async function handleFileDelete(fileId: string): Promise<Response> {
  try {
    const success = await fileStorage.deleteFile(fileId);
    if (!success) {
      return notFound();
    }
    
    return new Response('File deleted', { status: 200 });
  } catch (error) {
    console.error('File delete error:', error);
    return new Response('Delete failed', { status: 500 });
  }
}

async function handleGetFileUrl(fileId: string): Promise<Response> {
  try {
    const url = await fileStorage.getFileUrl(fileId);
    if (!url) {
      return notFound();
    }
    
    return new Response(JSON.stringify({ url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get file URL error:', error);
    return new Response('Failed to get URL', { status: 500 });
  }
}

console.log(`Slipbox server running at http://localhost:${config.port}`);
