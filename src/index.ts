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
  const results = await storage.searchNotes(query);

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleViewNote(id: string): Promise<Response> {
  const note = await storage.getNote(id);
  
  if (!note) {
    return notFound();
  }

  return htmlResponse(NotePage({ note }) as string);
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
