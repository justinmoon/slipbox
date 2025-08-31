import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { all, get, run } from "../db/index";
import type { File } from "../db/types";
import { localFileStorage } from "./local-file-storage";

export interface UploadFileOptions {
  noteId?: string;
  metadata?: Record<string, string>;
}

export class FileStorageService {
  async initialize() {
    await localFileStorage.initialize();
  }

  async uploadFile(
    file: File | Blob,
    originalName: string,
    mimeType: string,
    options: UploadFileOptions = {},
  ): Promise<File> {
    const id = uuidv4();
    const extension = path.extname(originalName);
    const fileKey = `${id}${extension}`;

    const buffer =
      file instanceof File
        ? Buffer.from(await file.arrayBuffer())
        : Buffer.from(await (file as Blob).arrayBuffer());

    const { size } = await localFileStorage.uploadFile(fileKey, buffer, {
      ...options.metadata,
      originalName,
      mimeType,
    });

    const now = new Date();

    run(
      `INSERT INTO files (id, original_name, mime_type, size, file_key, uploaded_at, note_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, originalName, mimeType, size, fileKey, now.getTime(), options.noteId || null],
    );

    return {
      id,
      originalName,
      mimeType,
      size,
      fileKey,
      uploadedAt: now,
      noteId: options.noteId || null,
    };
  }

  async getFile(id: string): Promise<File | null> {
    const file = get<File>(
      `SELECT 
        id, 
        original_name as originalName, 
        mime_type as mimeType, 
        size, 
        file_key as fileKey, 
        uploaded_at as uploadedAt, 
        note_id as noteId 
       FROM files 
       WHERE id = ? 
       LIMIT 1`,
      [id],
    );

    if (file) {
      file.uploadedAt = new Date(file.uploadedAt);
    }

    return file;
  }

  async downloadFile(id: string): Promise<{ buffer: Buffer; file: File } | null> {
    const file = await this.getFile(id);
    if (!file) return null;

    const buffer = await localFileStorage.downloadFile(file.fileKey);
    return { buffer, file };
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = await this.getFile(id);
    if (!file) return false;

    await localFileStorage.deleteFile(file.fileKey);

    const result = run(`DELETE FROM files WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  async getFileUrl(id: string, expiresIn: number = 3600): Promise<string | null> {
    const file = await this.getFile(id);
    if (!file) return null;

    return await localFileStorage.getFileUrl(file.fileKey, expiresIn);
  }

  async listFilesByNote(noteId: string): Promise<File[]> {
    const filesList = all<File>(
      `SELECT 
        id, 
        original_name as originalName, 
        mime_type as mimeType, 
        size, 
        file_key as fileKey, 
        uploaded_at as uploadedAt, 
        note_id as noteId 
       FROM files 
       WHERE note_id = ? 
       ORDER BY uploaded_at DESC`,
      [noteId],
    );

    // Convert timestamps to Date objects
    filesList.forEach((file) => {
      file.uploadedAt = new Date(file.uploadedAt);
    });

    return filesList;
  }

  async deleteFilesByNote(noteId: string): Promise<number> {
    const filesToDelete = await this.listFilesByNote(noteId);

    for (const file of filesToDelete) {
      await localFileStorage.deleteFile(file.fileKey);
    }

    const result = run(`DELETE FROM files WHERE note_id = ?`, [noteId]);
    return result.changes;
  }

  async getAllFiles(
    limit: number = 100,
    offset: number = 0,
  ): Promise<{
    files: File[];
    total: number;
  }> {
    const filesList = all<File>(
      `SELECT 
        id, 
        original_name as originalName, 
        mime_type as mimeType, 
        size, 
        file_key as fileKey, 
        uploaded_at as uploadedAt, 
        note_id as noteId 
       FROM files 
       ORDER BY uploaded_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    // Convert timestamps to Date objects
    filesList.forEach((file) => {
      file.uploadedAt = new Date(file.uploadedAt);
    });

    const totalResult = get<{ count: number }>(`SELECT COUNT(*) as count FROM files`);
    const total = totalResult?.count || 0;

    return {
      files: filesList,
      total,
    };
  }
}

export const fileStorage = new FileStorageService();
