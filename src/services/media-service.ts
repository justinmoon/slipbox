import { extname } from "node:path";
import { fileStorage } from "./file-storage";

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

function getMediaType(filename: string): { type: MediaFile["type"]; mimeType: string } {
  const ext = extname(filename).toLowerCase();
  return MEDIA_EXTENSIONS[ext] || { type: "other", mimeType: "application/octet-stream" };
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

    // Get all files from filesystem (no more database)
    const { files: fsFiles } = await fileStorage.getAllFiles(1000, 0);
    console.log(`Found ${fsFiles.length} files in filesystem`);

    for (const file of fsFiles) {
      const { type, mimeType } = getMediaType(file.filename);
      if (type === "other" && !file.filename.endsWith(".md")) {
        // Include non-markdown files even if we don't recognize the extension
        allFiles.push({
          id: file.filename,
          name: file.filename,
          type: "other",
          mimeType: file.mimeType || mimeType,
          size: file.size,
          modified: file.uploadedAt,
          url: `/${file.filename}`,
          thumbnailUrl: undefined,
          source: "filesystem",
        });
      } else if (type !== "other") {
        allFiles.push({
          id: file.filename,
          name: file.filename,
          type,
          mimeType: file.mimeType || mimeType,
          size: file.size,
          modified: file.uploadedAt,
          url: `/${file.filename}`,
          thumbnailUrl: type === "image" ? `/${file.filename}` : undefined,
          source: "filesystem",
        });
      }
    }

    // No need to scan filesystem again - we already got all files above

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
