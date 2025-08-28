import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/web";
import { NoteStorage } from "./storage";
import { config } from "./config";
import { NoteMetadata } from "./types";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { fileStorage } from "./services/file-storage";
import { mediaService } from "./services/media-service";
import { db } from "./db/index";
import { epubReadingPositions } from "./db/schema";
import { eq } from "drizzle-orm";
import { embeddedAssets } from "./embed-assets";

// Templates
import { HomePage } from "./templates/HomePage";
import { NotePage } from "./templates/NotePage";
import { EditNotePage } from "./templates/EditNotePage";
import { ReaderPage } from "./templates/ReaderPage";
import { EpubReaderPage } from "./templates/EpubReaderPage";
import { UploadPage } from "./templates/UploadPage";
import { LoginPage } from "./templates/LoginPage";
import { MediaPage } from "./templates/MediaPage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = new NoteStorage();

// Initialize storage services
await fileStorage.initialize();

// Simple in-memory session storage
const sessions = new Map<string, { expires: number }>();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD = "Golf1234";

// Generate session token
function generateSessionToken(): string {
  return crypto.randomUUID();
}

// Check if session is valid
function isValidSession(token: string | null): boolean {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// Get session token from cookie
function getSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session="));
  if (!sessionCookie) return null;

  return sessionCookie.split("=")[1];
}

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
      .filter((file) => file.originalName.toLowerCase().endsWith(".epub"))
      .map((file) => ({
        id: file.id,
        name: file.originalName.replace(/\.epub$/i, ""),
        size: file.size,
        modified: file.uploadedAt,
      }));

    return epubFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  } catch (error) {
    console.error("Error fetching EPUB files:", error);
    return [];
  }
}

// Helper to serve static files and transpile TypeScript on the fly in development
async function serveStatic(path: string): Promise<Response> {
  const isDev = process.env.NODE_ENV !== "production";
  const isCompiled = import.meta.url.startsWith("file:/$bunfs/");

  // In development, serve TypeScript files directly with transpilation
  if (isDev && !isCompiled && path.startsWith("/client/") && path.endsWith(".ts")) {
    const tsPath = join(__dirname, "..", "src", path);
    const file = Bun.file(tsPath);

    if (await file.exists()) {
      const result = await Bun.build({
        entrypoints: [tsPath],
        target: "browser",
        minify: false,
        sourcemap: "inline",
      });

      if (result.success && result.outputs.length > 0) {
        return new Response(await result.outputs[0].text(), {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }
  }

  // Handle different path types
  let filePath: string;
  if (path.startsWith("/dist/")) {
    // Already a dist path
    filePath = path;
  } else if (path.startsWith("/client/")) {
    // Client module - serve from dist/client
    filePath = `/dist${path}`;
  } else if (path.startsWith("/static/")) {
    // Legacy static path - try dist first
    filePath = path.replace("/static/", "/dist/");
  } else {
    filePath = path;
  }

  // Check embedded assets first (for production builds)
  if (embeddedAssets.has(filePath)) {
    const content = embeddedAssets.get(filePath)!;
    const contentType = filePath.endsWith(".js")
      ? "application/javascript"
      : filePath.endsWith(".css")
        ? "text/css"
        : "application/octet-stream";
    return new Response(content, {
      headers: { "Content-Type": contentType },
    });
  }

  // When running as compiled binary, look for files relative to the binary location
  if (isCompiled) {
    // Get the directory where the binary is located
    const binaryDir = process.cwd();
    const localFilePath = join(binaryDir, filePath);
    const localFile = Bun.file(localFilePath);

    if (await localFile.exists()) {
      const ext = filePath.split(".").pop();
      const contentType =
        ext === "js"
          ? "application/javascript"
          : ext === "css"
            ? "text/css"
            : ext === "html"
              ? "text/html"
              : "application/octet-stream";

      return new Response(localFile, {
        headers: { "Content-Type": contentType },
      });
    }
  }

  // Try to serve from filesystem (development mode)
  const file = Bun.file(join(__dirname, "..", filePath));

  if (await file.exists()) {
    const ext = filePath.split(".").pop();
    const contentType =
      ext === "js"
        ? "application/javascript"
        : ext === "css"
          ? "text/css"
          : ext === "html"
            ? "text/html"
            : "application/octet-stream";

    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  }

  // Fallback for backward compatibility
  const fallbackFile = Bun.file(join(__dirname, "..", path));
  return new Response(fallbackFile);
}

// Helper to create HTML response
function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}

// Helper to create not found response
function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

// Check if request needs authentication
function needsAuth(path: string): boolean {
  // Skip auth in test mode
  if (process.env.NODE_ENV === "test") return false;
  // Login page doesn't need auth
  if (path === "/login") return false;
  // Auto-login route doesn't need auth (development only)
  if (path === "/auto-login" && process.env.NODE_ENV !== "production") return false;
  // Static files don't need auth
  if (path.startsWith("/static/") || path.startsWith("/client/") || path.startsWith("/dist/"))
    return false;
  // Hot-reload SSE doesn't need auth (development only)
  if (path === "/hot-reload-sse") return false;
  return true;
}

// Main server
Bun.serve({
  port: config.port,
  async fetch(req: Request) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Check authentication for protected routes
    if (needsAuth(path)) {
      const sessionToken = getSessionToken(req);
      if (!isValidSession(sessionToken)) {
        // Redirect to login page
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/login",
          },
        });
      }
    }

    // Hot-reload SSE endpoint for development
    if (path === "/hot-reload-sse" && process.env.NODE_ENV !== "production") {
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            // Send initial connection message
            controller.enqueue(encoder.encode(":connected\n\n"));

            // Keep connection alive with periodic pings
            const pingInterval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(":ping\n\n"));
              } catch (e) {
                clearInterval(pingInterval);
              }
            }, 30000);
          },
          cancel() {
            // Client disconnected
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      );
    }

    // Static files and client modules
    if (path.startsWith("/static/") || path.startsWith("/client/") || path.startsWith("/dist/")) {
      return serveStatic(path);
    }

    // Routes
    switch (path) {
      case "/login":
        if (req.method === "GET") {
          return handleLoginPage();
        } else if (req.method === "POST") {
          return handleLogin(req);
        }
        break;

      case "/logout":
        return handleLogout(req);

      case "/auto-login":
        // Development-only auto-login route
        if (process.env.NODE_ENV !== "production") {
          return handleAutoLogin();
        }
        break;

      case "/":
        return handleHome(url);

      case "/search":
        return handleSearch(url);

      case "/new":
        // Create empty note and redirect to edit page
        return handleCreateEmptyNote();

      case "/reader":
        return handleReader();

      case "/media":
        return handleMedia();

      case "/upload":
        return handleUpload();
    }

    // Dynamic routes
    const noteMatch = path.match(/^\/note\/([a-f0-9-]+\.md)$/);
    if (noteMatch) {
      const id = noteMatch[1];
      if (req.method === "GET") {
        return handleViewNote(id);
      } else if (req.method === "POST") {
        return handleUpdateNote(req, id);
      } else if (req.method === "DELETE") {
        return handleDeleteNote(id);
      }
    }

    const editMatch = path.match(/^\/edit\/([a-f0-9-]+\.md)$/);
    if (editMatch) {
      return handleEditNote(editMatch[1]);
    }

    // Reader routes - Handle the epub viewer page
    const epubViewerMatch = path.match(/^\/epub\/([a-f0-9-]+)$/);
    if (epubViewerMatch) {
      const fileId = epubViewerMatch[1];
      return handleEpubViewer(fileId);
    }

    // Serve EPUB file content
    if (path.startsWith("/epub-file/")) {
      const fileId = decodeURIComponent(path.slice(11));
      return handleServeEpub(req, fileId);
    }

    // File upload/download routes
    if (path === "/api/files/upload" && req.method === "POST") {
      return handleFileUpload(req);
    }

    const fileMatch = path.match(/^\/api\/files\/([a-f0-9-]+)$/);
    if (fileMatch) {
      const fileId = fileMatch[1];
      if (req.method === "GET") {
        return handleFileDownload(fileId);
      } else if (req.method === "DELETE") {
        return handleFileDelete(fileId);
      }
    }

    const fileUrlMatch = path.match(/^\/api\/files\/([a-f0-9-]+)\/url$/);
    if (fileUrlMatch) {
      return handleGetFileUrl(fileUrlMatch[1]);
    }

    // Media file routes
    const downloadMatch = path.match(/^\/api\/files\/download\/([a-f0-9-]+)$/);
    if (downloadMatch && req.method === "GET") {
      return handleFileDownload(downloadMatch[1]);
    }

    const thumbnailMatch = path.match(/^\/api\/files\/thumbnail\/([a-f0-9-]+)$/);
    if (thumbnailMatch && req.method === "GET") {
      return handleThumbnail(thumbnailMatch[1]);
    }

    // Direct filesystem media access
    const mediaFileMatch = path.match(/^\/api\/media\/file\/([a-f0-9]+)$/);
    if (mediaFileMatch && req.method === "GET") {
      const filepath = url.searchParams.get("path");
      if (filepath) {
        return handleDirectMediaFile(filepath);
      }
    }

    const mediaThumbnailMatch = path.match(/^\/api\/media\/thumbnail\/([a-f0-9]+)$/);
    if (mediaThumbnailMatch && req.method === "GET") {
      const filepath = url.searchParams.get("path");
      if (filepath) {
        return handleDirectMediaThumbnail(filepath);
      }
    }

    // Reading position API endpoints
    if (path === "/api/reading-position" && req.method === "POST") {
      return handleSaveReadingPosition(req);
    }

    const positionMatch = path.match(/^\/api\/reading-position\/([a-f0-9-]+)$/);
    if (positionMatch && req.method === "GET") {
      return handleGetReadingPosition(positionMatch[1]);
    }

    return notFound();
  },
});

// Route handlers
function handleLoginPage(): Response {
  return htmlResponse(LoginPage({}) as string);
}

async function handleLogin(req: Request): Promise<Response> {
  const formData = await req.formData();
  const password = formData.get("password") as string;

  if (password === PASSWORD) {
    // Create session
    const token = generateSessionToken();
    sessions.set(token, { expires: Date.now() + SESSION_DURATION });

    // Redirect to home with session cookie
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}`,
      },
    });
  } else {
    // Show error
    return htmlResponse(LoginPage({ error: "Invalid password" }) as string);
  }
}

function handleLogout(req: Request): Response {
  const sessionToken = getSessionToken(req);
  if (sessionToken) {
    sessions.delete(sessionToken);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    },
  });
}

function handleAutoLogin(): Response {
  // Create session automatically for development
  const token = generateSessionToken();
  sessions.set(token, { expires: Date.now() + SESSION_DURATION });

  // Return an HTML page that auto-submits and redirects
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Auto-login</title>
</head>
<body>
  <script>
    // Set cookie and redirect
    document.cookie = "session=${token}; Path=/; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}";
    window.location.href = '/';
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}`,
    },
  });
}

async function handleHome(url: URL): Promise<Response> {
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("q") || "";
  const pageSize = Math.min(
    Math.max(
      parseInt(url.searchParams.get("limit") || String(config.defaultPageSize)),
      config.minPageSize,
    ),
    config.maxPageSize,
  );

  let notes, totalPages, currentPage;

  if (query.trim()) {
    // If there's a search query, get search results with pagination
    const allResults = await storage.searchNotes(query);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    // Convert SearchResult to NoteMetadata for display (search results don't have dates)
    notes = paginatedResults.map(
      (result) =>
        ({
          id: result.id,
          content: result.content,
          created: new Date(), // Placeholder
          modified: new Date(), // Placeholder
          matchCount: result.matchCount, // Add match count for display
        }) as NoteMetadata & { matchCount: number },
    );

    totalPages = Math.ceil(allResults.length / pageSize);
    currentPage = page;
  } else {
    // Regular pagination
    const result = await storage.listNotes(page, pageSize);
    notes = result.notes;
    totalPages = result.totalPages;
    currentPage = result.currentPage;
  }

  return htmlResponse(HomePage({ notes, totalPages, currentPage, query }) as string);
}

async function handleSearch(url: URL): Promise<Response> {
  const query = url.searchParams.get("q") || "";

  console.log(`[SEARCH] Query: "${query}"`);

  if (!query.trim()) {
    // Return to regular paginated view
    const { notes } = await storage.listNotes(1, config.defaultPageSize);
    return ServerSentEventGenerator.stream((stream) => {
      const notesHtml = notes
        .map(
          (note) =>
            `<a href="/note/${note.id}" class="no-underline text-inherit block h-full">
          <article class="border-2 border-dark bg-off-white p-6 h-full flex flex-col justify-between hover:shadow-[3px_3px_0_#111] transition-shadow">
            <p class="text-base text-dark mb-2" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${(note.content || "(empty note)").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            <time class="text-sm text-gray-600 italic">${note.modified.toLocaleDateString()}</time>
          </article>
        </a>`,
        )
        .join("");

      stream.mergeFragments(
        `<div id="notes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">${notesHtml}</div>`,
        { selector: "#notes-grid", mergeMode: "morph" },
      );
    });
  }

  const results = await storage.searchNotes(query);
  console.log(`[SEARCH] Found ${results.length} results`);

  // Pre-build the HTML outside the stream callback to avoid JavaScript restrictions
  let htmlContent: string;

  if (results.length === 0) {
    htmlContent =
      '<div id="notes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">' +
      '<p class="col-span-full text-center italic text-gray-600 py-8">No notes found matching "' +
      query.replace(/"/g, "&quot;") +
      '"</p></div>';
  } else {
    let articlesHtml = "";
    for (const result of results) {
      const safeContent = result.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      const matchText = result.matchCount + " match" + (result.matchCount !== 1 ? "es" : "");

      articlesHtml +=
        '<a href="/note/' +
        result.id +
        '" class="no-underline text-inherit block h-full">' +
        '<article class="border-2 border-dark bg-off-white p-6 h-full flex flex-col justify-between hover:shadow-[3px_3px_0_#111] transition-shadow">' +
        '<p class="text-base text-dark mb-2" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">' +
        safeContent +
        "</p>" +
        '<span class="text-sm text-gray-600 italic">' +
        matchText +
        "</span>" +
        "</article>" +
        "</a>";
    }

    htmlContent =
      '<div id="notes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">' +
      articlesHtml +
      "</div>";
  }

  console.log(
    `[SEARCH] Pre-built HTML (${htmlContent.length} chars) for ${results.length} results`,
  );

  return ServerSentEventGenerator.stream((stream) => {
    stream.mergeFragments(htmlContent, { selector: "#notes-grid", mergeMode: "morph" });
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

async function handleCreateEmptyNote(): Promise<Response> {
  // Create a new empty note
  const note = await storage.createNote("");

  // Redirect to the edit page for the new note
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/edit/${note.id}`,
    },
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
  // Parse JSON body
  let content: string;

  try {
    const body = (await req.json()) as { content?: string };
    content = body.content || "";
  } catch (error) {
    return new Response("Invalid request body", { status: 400 });
  }

  const note = await storage.updateNote(id, content);

  if (!note) {
    return notFound();
  }

  // Simple success response
  return new Response("OK", { status: 200 });
}

async function handleDeleteNote(id: string): Promise<Response> {
  const success = await storage.deleteNote(id);

  if (!success) {
    return notFound();
  }

  // Simple success response - client handles redirect
  return new Response("OK", { status: 200 });
}

// Reader handlers
async function handleReader(): Promise<Response> {
  const epubFiles = await getEpubFiles();
  return htmlResponse(ReaderPage({ epubFiles }) as string);
}

async function handleEpubViewer(fileId: string): Promise<Response> {
  console.log("handleEpubViewer called for:", fileId);

  // Get file info from storage
  try {
    const fileInfo = await fileStorage.getFile(fileId);
    if (!fileInfo || !fileInfo.originalName.toLowerCase().endsWith(".epub")) {
      return notFound();
    }

    const bookName = fileInfo.originalName.replace(/\.epub$/i, "");
    const bookUrl = `/epub-file/${encodeURIComponent(fileId)}`;

    return htmlResponse(EpubReaderPage({ bookName, bookUrl, fileId }) as string);
  } catch (error) {
    console.error("Error fetching book:", error);
    return notFound();
  }
}

// Upload handler
function handleUpload(): Response {
  return htmlResponse(UploadPage() as string);
}

// Media handler
async function handleMedia(): Promise<Response> {
  const { files, total } = await mediaService.getAllMediaFiles(100, 0);
  return htmlResponse(MediaPage({ files, totalFiles: total }) as string);
}

async function handleServeEpub(req: Request, fileId: string): Promise<Response> {
  try {
    const fileInfo = await fileStorage.getFile(fileId);
    if (!fileInfo || !fileInfo.originalName.toLowerCase().endsWith(".epub")) {
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
        },
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
      },
    });
  } catch (error) {
    console.error("Error serving EPUB:", error);
    return new Response("Error serving file", { status: 500 });
  }
}

// File upload/download handlers
async function handleFileUpload(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as unknown as File;
    const noteId = formData.get("noteId") as string | null;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    const savedFile = await fileStorage.uploadFile(
      file,
      file.name,
      file.type || "application/octet-stream",
      { noteId: noteId || undefined },
    );

    return new Response(JSON.stringify(savedFile), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("File upload error:", error);
    return new Response("Upload failed", { status: 500 });
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
        "Content-Type": result.file.mimeType,
        "Content-Disposition": `attachment; filename="${result.file.originalName}"`,
        "Content-Length": result.file.size.toString(),
      },
    });
  } catch (error) {
    console.error("File download error:", error);
    return new Response("Download failed", { status: 500 });
  }
}

async function handleFileDelete(fileId: string): Promise<Response> {
  try {
    const success = await fileStorage.deleteFile(fileId);
    if (!success) {
      return notFound();
    }

    return new Response("File deleted", { status: 200 });
  } catch (error) {
    console.error("File delete error:", error);
    return new Response("Delete failed", { status: 500 });
  }
}

async function handleGetFileUrl(fileId: string): Promise<Response> {
  try {
    const url = await fileStorage.getFileUrl(fileId);
    if (!url) {
      return notFound();
    }

    return new Response(JSON.stringify({ url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get file URL error:", error);
    return new Response("Failed to get URL", { status: 500 });
  }
}

// Thumbnail handler for database files
async function handleThumbnail(fileId: string): Promise<Response> {
  try {
    const result = await fileStorage.downloadFile(fileId);
    if (!result) {
      return notFound();
    }

    // For images, return the image directly (browser will handle resizing)
    if (result.file.mimeType.startsWith("image/")) {
      return new Response(result.buffer, {
        headers: {
          "Content-Type": result.file.mimeType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // For other types, return a placeholder
    return notFound();
  } catch (error) {
    console.error("Thumbnail error:", error);
    return new Response("Thumbnail failed", { status: 500 });
  }
}

// Direct filesystem media file handler
async function handleDirectMediaFile(filepath: string): Promise<Response> {
  try {
    const { readFile } = await import("fs/promises");
    const { join, extname } = await import("path");

    // Security: prevent directory traversal
    if (filepath.includes("..") || filepath.includes("/")) {
      return new Response("Invalid path", { status: 400 });
    }

    const fullPath = join(config.dataDir, filepath);
    const buffer = await readFile(fullPath);

    // Determine mime type
    const ext = extname(filepath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".pdf": "application/pdf",
      ".epub": "application/epub+zip",
    };

    const mimeType = mimeTypes[ext] || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filepath}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Direct media file error:", error);
    return notFound();
  }
}

// Direct filesystem thumbnail handler
async function handleDirectMediaThumbnail(filepath: string): Promise<Response> {
  // For now, just serve the full image for thumbnails
  // In production, you'd want proper thumbnail generation
  return handleDirectMediaFile(filepath);
}

// Reading position handlers
async function handleSaveReadingPosition(req: Request): Promise<Response> {
  try {
    const data = (await req.json()) as {
      fileId: string;
      cfi: string;
      percentage: number;
      fontSize?: number;
    };

    if (!data.fileId || !data.cfi) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Check if position exists for this file
    const existing = await db
      .select()
      .from(epubReadingPositions)
      .where(eq(epubReadingPositions.fileId, data.fileId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing position
      await db
        .update(epubReadingPositions)
        .set({
          cfi: data.cfi,
          percentage: data.percentage || 0,
          fontSize: data.fontSize || 100,
          updatedAt: new Date(),
        })
        .where(eq(epubReadingPositions.id, existing[0].id));
    } else {
      // Create new position
      await db.insert(epubReadingPositions).values({
        id: crypto.randomUUID(),
        fileId: data.fileId,
        cfi: data.cfi,
        percentage: data.percentage || 0,
        fontSize: data.fontSize || 100,
        updatedAt: new Date(),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Save reading position error:", error);
    return new Response("Failed to save position", { status: 500 });
  }
}

async function handleGetReadingPosition(fileId: string): Promise<Response> {
  try {
    const position = await db
      .select()
      .from(epubReadingPositions)
      .where(eq(epubReadingPositions.fileId, fileId))
      .limit(1);

    if (position.length === 0) {
      return new Response(JSON.stringify({ cfi: null, percentage: 0, fontSize: 100 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        cfi: position[0].cfi,
        percentage: position[0].percentage,
        fontSize: position[0].fontSize || 100,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Get reading position error:", error);
    return new Response("Failed to get position", { status: 500 });
  }
}

// Make port visible on every restart
const separator = "=".repeat(50);
console.log(`\n${separator}`);
console.log(`🚀 Slipbox server running at http://localhost:${config.port}`);
if (process.env.DEV_MODE === "true") {
  console.log(`📝 Watching for file changes...`);
}
console.log(`${separator}\n`);
