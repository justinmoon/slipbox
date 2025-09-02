import { constants } from "node:fs";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ALWAYS require SLIPBOX_DATA_DIR
const getStorageDir = () => {
  if (!process.env.SLIPBOX_DATA_DIR) {
    throw new Error(
      "SLIPBOX_DATA_DIR environment variable is required. Run scripts/init.sh to set up.",
    );
  }
  return process.env.SLIPBOX_DATA_DIR;
};

const LOCAL_STORAGE_DIR = getStorageDir();

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
    // Return direct URL to the file
    return `http://localhost:${process.env.PORT || 3000}/${key}`;
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
