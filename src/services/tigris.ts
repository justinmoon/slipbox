import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const TIGRIS_ENDPOINT = process.env.TIGRIS_ENDPOINT || 'https://fly.storage.tigris.dev';
const BUCKET_NAME = process.env.TIGRIS_BUCKET_NAME || 'slipbox-files';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: TIGRIS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.TIGRIS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.TIGRIS_SECRET_ACCESS_KEY || '',
  },
});

export class TigrisStorage {
  async initialize() {
    try {
      // Check if bucket exists by trying to list objects
      await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        MaxKeys: 1,
      }));
      console.log(`Tigris bucket '${BUCKET_NAME}' ready`);
    } catch (error: any) {
      if (error.name === 'NoSuchBucket') {
        console.error(`Tigris bucket '${BUCKET_NAME}' does not exist. Please create it first.`);
        throw error;
      }
      // If it's a different error, the bucket might exist but we have other issues
      console.log(`Tigris bucket '${BUCKET_NAME}' check completed with warning:`, error.message);
    }
  }

  async uploadFile(key: string, file: File | Blob | Buffer, metadata?: Record<string, string>) {
    const buffer = file instanceof Buffer ? file : Buffer.from(await (file as Blob).arrayBuffer());
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      Metadata: metadata,
    }));

    return {
      key,
      bucket: BUCKET_NAME,
      size: buffer.length,
    };
  }

  async downloadFile(key: string): Promise<Buffer> {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  async deleteFile(key: string) {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  async listFiles(prefix?: string, limit: number = 100) {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: limit,
    }));

    return response.Contents || [];
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

export const tigrisStorage = new TigrisStorage();