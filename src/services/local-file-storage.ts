import { mkdir, writeFile, readFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || join(process.env.NOTES_DIR || join(process.env.HOME!, '.slipbox-dev'), 'files');

export class LocalFileStorage {
  async initialize() {
    await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
    console.log(`Local file storage ready at: ${LOCAL_STORAGE_DIR}`);
  }

  async uploadFile(key: string, file: File | Blob | Buffer, metadata?: Record<string, string>) {
    const buffer = file instanceof Buffer ? file : Buffer.from(await (file as Blob).arrayBuffer());
    const filePath = join(LOCAL_STORAGE_DIR, key);
    
    await writeFile(filePath, buffer);
    
    if (metadata) {
      await writeFile(`${filePath}.meta.json`, JSON.stringify(metadata));
    }

    return {
      key,
      bucket: 'local',
      size: buffer.length,
    };
  }

  async downloadFile(key: string): Promise<Buffer> {
    const filePath = join(LOCAL_STORAGE_DIR, key);
    return await readFile(filePath);
  }

  async deleteFile(key: string) {
    const filePath = join(LOCAL_STORAGE_DIR, key);
    await unlink(filePath);
    
    try {
      await unlink(`${filePath}.meta.json`);
    } catch {
      // Metadata file might not exist
    }
  }

  async getFileUrl(key: string, _expiresIn: number = 3600): Promise<string> {
    // For local development, return a direct URL to the file endpoint
    return `http://localhost:${process.env.PORT || 3000}/api/files/${key}`;
  }

  async listFiles(_prefix?: string, _limit: number = 100) {
    // Simple implementation - in production you'd want proper filtering
    return [];
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const filePath = join(LOCAL_STORAGE_DIR, key);
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export const localFileStorage = new LocalFileStorage();