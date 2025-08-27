import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { config } from '../config';
import { fileStorage } from './file-storage';
import { createHash } from 'crypto';

export interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'epub' | 'other';
  mimeType: string;
  size: number;
  modified: Date;
  thumbnailUrl?: string;
  url: string;
  source: 'database' | 'filesystem';
}

const MEDIA_EXTENSIONS: Record<string, { type: MediaFile['type']; mimeType: string }> = {
  // Images
  '.jpg': { type: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { type: 'image', mimeType: 'image/jpeg' },
  '.png': { type: 'image', mimeType: 'image/png' },
  '.gif': { type: 'image', mimeType: 'image/gif' },
  '.webp': { type: 'image', mimeType: 'image/webp' },
  '.svg': { type: 'image', mimeType: 'image/svg+xml' },
  
  // Videos
  '.mp4': { type: 'video', mimeType: 'video/mp4' },
  '.webm': { type: 'video', mimeType: 'video/webm' },
  '.ogg': { type: 'video', mimeType: 'video/ogg' },
  '.mov': { type: 'video', mimeType: 'video/quicktime' },
  '.avi': { type: 'video', mimeType: 'video/x-msvideo' },
  
  // Audio
  '.mp3': { type: 'audio', mimeType: 'audio/mpeg' },
  '.wav': { type: 'audio', mimeType: 'audio/wav' },
  '.m4a': { type: 'audio', mimeType: 'audio/mp4' },
  '.flac': { type: 'audio', mimeType: 'audio/flac' },
  
  // Documents
  '.pdf': { type: 'pdf', mimeType: 'application/pdf' },
  '.epub': { type: 'epub', mimeType: 'application/epub+zip' },
};

function getMediaType(filename: string): { type: MediaFile['type']; mimeType: string } {
  const ext = extname(filename).toLowerCase();
  return MEDIA_EXTENSIONS[ext] || { type: 'other', mimeType: 'application/octet-stream' };
}

function generateFileId(path: string): string {
  return createHash('md5').update(path).digest('hex');
}

export class MediaService {
  async getAllMediaFiles(limit: number = 100, offset: number = 0): Promise<{
    files: MediaFile[];
    total: number;
  }> {
    const allFiles: MediaFile[] = [];
    
    // Get files from database
    const { files: dbFiles, total: dbTotal } = await fileStorage.getAllFiles(1000, 0);
    
    for (const file of dbFiles) {
      const { type, mimeType } = getMediaType(file.originalName);
      if (type === 'other' && !file.originalName.endsWith('.md')) {
        // Include non-markdown files even if we don't recognize the extension
        allFiles.push({
          id: file.id,
          name: file.originalName,
          type: 'other',
          mimeType: file.mimeType || mimeType,
          size: file.size,
          modified: file.uploadedAt,
          url: `/api/files/download/${file.id}`,
          thumbnailUrl: type === 'image' ? `/api/files/thumbnail/${file.id}` : undefined,
          source: 'database'
        });
      } else if (type !== 'other') {
        allFiles.push({
          id: file.id,
          name: file.originalName,
          type,
          mimeType: file.mimeType || mimeType,
          size: file.size,
          modified: file.uploadedAt,
          url: `/api/files/download/${file.id}`,
          thumbnailUrl: type === 'image' ? `/api/files/thumbnail/${file.id}` : undefined,
          source: 'database'
        });
      }
    }
    
    // Scan filesystem for additional media files
    try {
      const files = await readdir(config.dataDir);
      
      for (const filename of files) {
        // Skip markdown files, metadata files, and database files
        if (filename.endsWith('.md') || 
            filename.endsWith('.meta.json') || 
            filename.includes('.db') ||
            filename === '.DS_Store' ||
            filename === 'files') {
          continue;
        }
        
        const filepath = join(config.dataDir, filename);
        const stats = await stat(filepath);
        
        if (stats.isFile()) {
          const { type, mimeType } = getMediaType(filename);
          const fileId = generateFileId(filepath);
          
          allFiles.push({
            id: fileId,
            name: filename,
            type,
            mimeType,
            size: stats.size,
            modified: stats.mtime,
            url: `/api/media/file/${fileId}?path=${encodeURIComponent(filename)}`,
            thumbnailUrl: type === 'image' ? `/api/media/thumbnail/${fileId}?path=${encodeURIComponent(filename)}` : undefined,
            source: 'filesystem'
          });
        }
      }
    } catch (error) {
      console.error('Error scanning filesystem for media files:', error);
    }
    
    // Sort by modified date (newest first)
    allFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
    // Apply pagination
    const paginatedFiles = allFiles.slice(offset, offset + limit);
    
    return {
      files: paginatedFiles,
      total: allFiles.length
    };
  }
}

export const mediaService = new MediaService();