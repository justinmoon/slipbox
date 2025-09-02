import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { localFileStorage } from "./local-file-storage";

export interface FileInfo {
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export class FileStorageService {
  async initialize() {
    await localFileStorage.initialize();
  }

  async uploadFile(file: File | Blob, originalName: string, mimeType: string): Promise<FileInfo> {
    const extension = path.extname(originalName);
    const filename = `${nanoid()}${extension}`;

    const buffer =
      file instanceof File
        ? Buffer.from(await file.arrayBuffer())
        : Buffer.from(await (file as Blob).arrayBuffer());

    await localFileStorage.uploadFile(filename, buffer, {
      originalName,
      mimeType,
    });

    return {
      filename,
      size: buffer.length,
      mimeType,
      uploadedAt: new Date(),
    };
  }

  async getFile(filename: string): Promise<FileInfo | null> {
    try {
      const exists = await localFileStorage.fileExists(filename);
      if (!exists) return null;

      // Get file stats from filesystem
      const dataDir = process.env.SLIPBOX_DATA_DIR!;
      const filePath = path.join(dataDir, filename);
      const stats = await stat(filePath);

      // Determine mime type from extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".epub": "application/epub+zip",
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
      };
      const mimeType = mimeTypes[ext] || "application/octet-stream";

      return {
        filename,
        size: stats.size,
        mimeType,
        uploadedAt: stats.mtime,
      };
    } catch (error) {
      console.error(`Error getting file ${filename}:`, error);
      return null;
    }
  }

  async downloadFile(filename: string): Promise<{ buffer: Buffer; file: FileInfo } | null> {
    const file = await this.getFile(filename);
    if (!file) return null;

    const buffer = await localFileStorage.downloadFile(filename);
    return { buffer, file };
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      await localFileStorage.deleteFile(filename);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${filename}:`, error);
      return false;
    }
  }

  async getFileUrl(filename: string, expiresIn: number = 3600): Promise<string | null> {
    const exists = await localFileStorage.fileExists(filename);
    if (!exists) return null;

    return await localFileStorage.getFileUrl(filename, expiresIn);
  }

  async getAllFiles(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{
    files: FileInfo[];
    total: number;
  }> {
    try {
      const dataDir = process.env.SLIPBOX_DATA_DIR!;
      const allFiles = await readdir(dataDir);

      // Filter out non-files and get stats
      const fileInfos: FileInfo[] = [];
      for (const filename of allFiles) {
        // Skip hidden files and directories
        if (filename.startsWith(".")) continue;

        const filePath = path.join(dataDir, filename);
        try {
          const stats = await stat(filePath);
          if (!stats.isFile()) continue;

          const ext = path.extname(filename).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".epub": "application/epub+zip",
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
          };
          const mimeType = mimeTypes[ext] || "application/octet-stream";

          fileInfos.push({
            filename,
            size: stats.size,
            mimeType,
            uploadedAt: stats.mtime,
          });
        } catch (error) {
          console.error(`Error getting stats for ${filename}:`, error);
        }
      }

      // Sort by upload date (newest first)
      fileInfos.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

      // Apply pagination
      const paginatedFiles = fileInfos.slice(offset, offset + limit);

      return {
        files: paginatedFiles,
        total: fileInfos.length,
      };
    } catch (error) {
      console.error("Error listing files:", error);
      return { files: [], total: 0 };
    }
  }
}

export const fileStorage = new FileStorageService();
