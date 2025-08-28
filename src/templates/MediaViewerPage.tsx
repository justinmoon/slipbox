import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Nav } from './Nav';
import type { MediaFile } from '../services/media-service';

interface MediaViewerPageProps {
  file: MediaFile;
}

export const MediaViewerPage = ({ file }: MediaViewerPageProps) => {
  const isVideo = /\.(mp4|webm|ogg|avi|mov)$/i.test(file.name);
  const isAudio = /\.(mp3|wav|m4a|ogg)$/i.test(file.name);
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
  const isPDF = /\.pdf$/i.test(file.name);
  const isEpub = /\.epub$/i.test(file.name);
  
  return (
    <Layout title={file.name}>
      <div class="container">
        <Nav currentPage="media" />
        
        <div class="viewer-header">
          <a href="/media" class="back-link">← Back to Media Library</a>
          <h1 class="text-2xl font-bold mt-4 mb-4">{file.name}</h1>
        </div>
        
        <div class="media-viewer">
          {isVideo && (
            <video 
              src={file.url}
              controls={true as any}
              autoplay={true as any}
              class="viewer-video"
            >
              Your browser does not support the video tag.
            </video>
          )}
          
          {isAudio && (
            <div class="audio-container">
              <div class="audio-icon">🎵</div>
              <audio 
                src={file.url}
                controls={true as any}
                autoplay={true as any}
                class="viewer-audio"
              >
                Your browser does not support the audio tag.
              </audio>
              <p class="text-gray-600 mt-4">{formatFileSize(file.size)}</p>
            </div>
          )}
          
          {isImage && (
            <img 
              src={file.url}
              alt={file.name}
              class="viewer-image"
            />
          )}
          
          {isPDF && (
            <div class="pdf-container">
              <iframe 
                src={file.url}
                class="viewer-pdf"
                title={file.name}
              />
              <p class="text-center mt-4">
                <a href={file.url} download={"download" as any} class="btn-download">
                  Download PDF
                </a>
              </p>
            </div>
          )}
          
          {isEpub && (
            <div class="epub-container">
              <div class="epub-icon">📚</div>
              <p class="text-xl mb-4">EPUB Document</p>
              <a href={`/epub/${file.id}`} class="btn-primary">
                Open in Reader
              </a>
              <p class="text-gray-600 mt-4">{formatFileSize(file.size)}</p>
            </div>
          )}
          
          {!isVideo && !isAudio && !isImage && !isPDF && !isEpub && (
            <div class="unsupported-container">
              <div class="file-icon">📄</div>
              <p class="text-xl mb-4">Preview not available</p>
              <a href={file.url} download={"download" as any} class="btn-download">
                Download File
              </a>
              <p class="text-gray-600 mt-4">{formatFileSize(file.size)}</p>
            </div>
          )}
        </div>
        
        <div class="file-details">
          <h3 class="text-lg font-semibold mb-2">File Information</h3>
          <dl class="details-list">
            <div class="detail-row">
              <dt>Name:</dt>
              <dd>{file.name}</dd>
            </div>
            <div class="detail-row">
              <dt>Size:</dt>
              <dd>{formatFileSize(file.size)}</dd>
            </div>
            <div class="detail-row">
              <dt>Type:</dt>
              <dd>{file.type}</dd>
            </div>
            <div class="detail-row">
              <dt>Modified:</dt>
              <dd>{new Date(file.modified).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>
      
      <style>{`
        .viewer-header {
          margin-bottom: 2rem;
        }
        
        .back-link {
          color: #666;
          text-decoration: none;
          transition: color 0.2s;
        }
        
        .back-link:hover {
          color: #111;
        }
        
        .media-viewer {
          background: white;
          border: 2px solid #111;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 2rem;
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .viewer-video,
        .viewer-image {
          max-width: 100%;
          max-height: 70vh;
          width: auto;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        
        .viewer-audio {
          width: 100%;
          max-width: 500px;
        }
        
        .audio-container,
        .epub-container,
        .unsupported-container {
          text-align: center;
          padding: 2rem;
        }
        
        .audio-icon,
        .epub-icon,
        .file-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        
        .pdf-container {
          width: 100%;
          height: 70vh;
        }
        
        .viewer-pdf {
          width: 100%;
          height: 100%;
          border: none;
        }
        
        .btn-primary,
        .btn-download {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #111;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .btn-primary:hover,
        .btn-download:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 0 rgba(0,0,0,0.2);
        }
        
        .file-details {
          background: white;
          border: 2px solid #111;
          border-radius: 8px;
          padding: 1.5rem;
        }
        
        .details-list {
          margin-top: 1rem;
        }
        
        .detail-row {
          display: flex;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .detail-row:last-child {
          border-bottom: none;
        }
        
        .detail-row dt {
          font-weight: 600;
          width: 120px;
          flex-shrink: 0;
        }
        
        .detail-row dd {
          color: #666;
        }
        
        @media (max-width: 640px) {
          .media-viewer {
            padding: 1rem;
          }
          
          .viewer-video,
          .viewer-image {
            max-height: 50vh;
          }
          
          .detail-row {
            flex-direction: column;
          }
          
          .detail-row dt {
            width: auto;
            margin-bottom: 0.25rem;
          }
        }
      `}</style>
    </Layout>
  );
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}