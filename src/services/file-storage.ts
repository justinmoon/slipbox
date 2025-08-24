import { db } from '../db/index';
import { files } from '../db/schema';
import type { File } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { tigrisStorage } from './tigris';
import { localFileStorage } from './local-file-storage';

const storage = process.env.USE_LOCAL_STORAGE === 'true' ? localFileStorage : tigrisStorage;

export interface UploadFileOptions {
  noteId?: string;
  metadata?: Record<string, string>;
}

export class FileStorageService {
  async initialize() {
    await storage.initialize();
  }

  async uploadFile(
    file: File | Blob,
    originalName: string,
    mimeType: string,
    options: UploadFileOptions = {}
  ): Promise<File> {
    const id = uuidv4();
    const extension = path.extname(originalName);
    const tigrisKey = `${id}${extension}`;
    
    const buffer = file instanceof File 
      ? Buffer.from(await file.arrayBuffer())
      : Buffer.from(await (file as Blob).arrayBuffer());
    
    const { size } = await storage.uploadFile(tigrisKey, buffer, {
      ...options.metadata,
      originalName,
      mimeType,
    });

    const [savedFile] = await db.insert(files).values({
      id,
      originalName,
      mimeType,
      size,
      tigrisKey,
      tigrisBucket: process.env.TIGRIS_BUCKET_NAME || 'slipbox-files',
      noteId: options.noteId,
    }).returning();

    return savedFile;
  }

  async getFile(id: string): Promise<File | null> {
    const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    return file || null;
  }

  async downloadFile(id: string): Promise<{ buffer: Buffer; file: File } | null> {
    const file = await this.getFile(id);
    if (!file) return null;

    const buffer = await storage.downloadFile(file.tigrisKey);
    return { buffer, file };
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = await this.getFile(id);
    if (!file) return false;

    await storage.deleteFile(file.tigrisKey);
    
    const result = await db.delete(files).where(eq(files.id, id));
    return result.changes > 0;
  }

  async getFileUrl(id: string, expiresIn: number = 3600): Promise<string | null> {
    const file = await this.getFile(id);
    if (!file) return null;

    return await storage.getFileUrl(file.tigrisKey, expiresIn);
  }

  async listFilesByNote(noteId: string): Promise<File[]> {
    return await db
      .select()
      .from(files)
      .where(eq(files.noteId, noteId))
      .orderBy(desc(files.uploadedAt));
  }

  async deleteFilesByNote(noteId: string): Promise<number> {
    const filesToDelete = await this.listFilesByNote(noteId);
    
    for (const file of filesToDelete) {
      await storage.deleteFile(file.tigrisKey);
    }

    const result = await db.delete(files).where(eq(files.noteId, noteId));
    return result.changes;
  }

  async getAllFiles(limit: number = 100, offset: number = 0): Promise<{
    files: File[];
    total: number;
  }> {
    const filesList = await db
      .select()
      .from(files)
      .orderBy(desc(files.uploadedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(files);

    return {
      files: filesList,
      total: count,
    };
  }
}

export const fileStorage = new FileStorageService();