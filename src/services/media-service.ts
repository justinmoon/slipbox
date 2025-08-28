import { readdir, stat } from "fs/promises";
import { join, extname } from "path";
import { config } from "../config";
import { fileStorage } from "./file-storage";
import { createHash } from "crypto";

export interface MediaFile {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "pdf" | "epub" | "other";
  mimeType: string;
  size: number;
  modified: Date;
  thumbnailUrl?: string;
  url: string;
  source: "database" | "filesystem";
}

const MEDIA_EXTENSIONS: Record<string, { type: MediaFile["type"]; mimeType: string }> = {
  // Images
  ".jpg": { type: "image", mimeType: "image/jpeg" },
  ".jpeg": { type: "image", mimeType: "image/jpeg" },
  ".png": { type: "image", mimeType: "image/png" },
  ".gif": { type: "image", mimeType: "image/gif" },
  ".webp": { type: "image", mimeType: "image/webp" },
  ".svg": { type: "image", mimeType: "image/svg+xml" },

  // Videos
  ".mp4": { type: "video", mimeType: "video/mp4" },
  ".webm": { type: "video", mimeType: "video/webm" },
  ".ogg": { type: "video", mimeType: "video/ogg" },
  ".mov": { type: "video", mimeType: "video/quicktime" },
  ".avi": { type: "video", mimeType: "video/x-msvideo" },

  // Audio
  ".mp3": { type: "audio", mimeType: "audio/mpeg" },
  ".wav": { type: "audio", mimeType: "audio/wav" },
  ".m4a": { type: "audio", mimeType: "audio/mp4" },
  ".flac": { type: "audio", mimeType: "audio/flac" },

  // Documents
  ".pdf": { type: "pdf", mimeType: "application/pdf" },
  ".epub": { type: "epub", mimeType: "application/epub+zip" },
};

export function getMediaType(filename: string): { type: MediaFile["type"]; mimeType: string } {
  const ext = extname(filename).toLowerCase();
  return MEDIA_EXTENSIONS[ext] || { type: "other", mimeType: "application/octet-stream" };
}

function generateFileId(path: string): string {
  return createHash("md5").update(path).digest("hex");
}

export class MediaService {
  async getAllMediaFiles(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{
    files: MediaFile[];
    total: number;
  }> {
    const allFiles: MediaFile[] = [];

    // Get files from database - only fetch what we need plus a buffer
    const { files: dbFiles } = await fileStorage.getAllFiles(limit + 50, offset);
    console.log(`Found ${dbFiles.length} files in database`);

    for (const file of dbFiles) {
      const { type, mimeType } = getMediaType(file.originalName);
      if (type === "other" && !file.originalName.endsWith(".md")) {
        // Include non-markdown files even if we don't recognize the extension
        allFiles.push({
          id: file.id,
          name: file.originalName,
          type: "other",
          mimeType: file.mimeType || mimeType,
          size: file.size,
          modified: file.uploadedAt,
          url: `/api/files/download/${file.id}`,
          thumbnailUrl: undefined,
          source: "database",
        });
      } else if (type !== "other") {
        allFiles.push({
          id: file.id,
          name: file.originalName,
          type,
          mimeType: file.mimeType || mimeType,
          size: file.size,
          modified: file.uploadedAt,
          url: `/api/files/download/${file.id}`,
          thumbnailUrl: type === "image" ? `/api/files/thumbnail/${file.id}` : undefined,
          source: "database",
        });
      }
    }

    // Only scan filesystem if we don't have enough files from database
    // This significantly improves performance
    if (allFiles.length < limit) {
      // Scan filesystem for additional media files
      try {
        const files = await readdir(config.dataDir);
        console.log(`Scanning ${config.dataDir}, found ${files.length} files`);

      let skipCount = 0;
      let addCount = 0;

      for (const filename of files) {
        // Skip markdown files, metadata files, and database files
        if (
          filename.endsWith(".md") ||
          filename.endsWith(".meta.json") ||
          filename.includes(".db") ||
          filename === ".DS_Store" ||
          filename === "files"
        ) {
          skipCount++;
          continue;
        }

        const filepath = join(config.dataDir, filename);
        const stats = await stat(filepath);

        if (stats.isFile()) {
          const { type, mimeType } = getMediaType(filename);
          const fileId = generateFileId(filepath);
          addCount++;

          allFiles.push({
            id: fileId,
            name: filename,
            type,
            mimeType,
            size: stats.size,
            modified: stats.mtime,
            url: `/api/media/file/${fileId}?path=${encodeURIComponent(filename)}`,
            thumbnailUrl:
              type === "image"
                ? `/api/media/thumbnail/${fileId}?path=${encodeURIComponent(filename)}`
                : undefined,
            source: "filesystem",
          });
        }
      }

        console.log(`Skipped ${skipCount} files, added ${addCount} files from filesystem`);
      } catch (error) {
        console.error("Error scanning filesystem for media files:", error);
      }
    }

    // Sort by type first, then by modified date (to get a mix of file types)
    allFiles.sort((a, b) => {
      if (a.type !== b.type) {
        // Group by type: images, videos, pdfs, epubs, audio, other
        const typeOrder = { image: 0, video: 1, pdf: 2, epub: 3, audio: 4, other: 5 };
        return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
      }
      return b.modified.getTime() - a.modified.getTime();
    });

    // Apply pagination
    const paginatedFiles = allFiles.slice(offset, offset + limit);

    console.log(`Total files: ${allFiles.length}, returning ${paginatedFiles.length} files`);
    console.log(
      `File types in ALL: EPUBs: ${allFiles.filter((f) => f.type === "epub").length}, PDFs: ${allFiles.filter((f) => f.type === "pdf").length}, Images: ${allFiles.filter((f) => f.type === "image").length}, Videos: ${allFiles.filter((f) => f.type === "video").length}`,
    );
    console.log(
      `File types RETURNED: EPUBs: ${paginatedFiles.filter((f) => f.type === "epub").length}, PDFs: ${paginatedFiles.filter((f) => f.type === "pdf").length}, Images: ${paginatedFiles.filter((f) => f.type === "image").length}, Videos: ${paginatedFiles.filter((f) => f.type === "video").length}`,
    );

    return {
      files: paginatedFiles,
      total: allFiles.length,
    };
  }
}

export const mediaService = new MediaService();
