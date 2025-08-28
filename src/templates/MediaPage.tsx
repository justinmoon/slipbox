import Html from "@kitajs/html";
import { Layout } from "./Layout";
import { Nav } from "./Nav";
import type { MediaFile } from "../services/media-service";

interface MediaPageProps {
  files: MediaFile[];
  totalFiles: number;
}

export const MediaPage = ({ files, totalFiles }: MediaPageProps) => {
  // Store files data in a way that Datastar can access
  const filesData = files.map((file, index) => ({
    ...file,
    index,
  }));

  return (
    <Layout title="Media Library">
      <div class="container">
        <Nav currentPage="media" />
        <div
          data-store={JSON.stringify({
            selectedFile: null,
            files: filesData,
          })}
        >
          <div class="mb-8">
            <h2 class="text-3xl font-bold mb-4">Media Library</h2>
            <p class="text-gray-600">
              {totalFiles} media files • {files.filter((f) => f.type === "image").length} images •
              {files.filter((f) => f.type === "video").length} videos •
              {files.filter((f) => f.type === "epub").length} ebooks •
              {files.filter((f) => f.type === "pdf").length} PDFs
            </p>
          </div>

          <div class="media-grid">
            {files.map((file, index) => (
              <div class="media-card" data-file-id={file.id}>
                {file.type === "image" ? (
                  <div class="media-thumbnail">
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.name}
                      loading="lazy"
                      data-on-click={`$selectedFile = $files[${index}]`}
                      class="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </div>
                ) : file.type === "video" ? (
                  <div class="media-thumbnail video-thumbnail">
                    <video
                      src={file.url}
                      {...{ preload: "metadata" }}
                      data-on-click={`$selectedFile = $files[${index}]`}
                      class="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    <div class="video-overlay">
                      <svg
                        class="play-icon"
                        viewBox="0 0 24 24"
                        fill="white"
                        width="48"
                        height="48"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div class="media-placeholder" data-on-click={`$selectedFile = $files[${index}]`}>
                    <div class="file-icon">
                      {file.type === "epub" && "📚"}
                      {file.type === "pdf" && "📄"}
                      {file.type === "audio" && "🎵"}
                      {file.type === "other" && "📁"}
                    </div>
                    <div class="file-info">
                      <p class="file-name">{file.name}</p>
                      <p class="file-size">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                )}
                <div class="media-caption">
                  <p class="text-sm truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p class="text-xs text-gray-500">
                    {new Date(file.modified).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Media viewer modal */}
          <div
            class="media-modal"
            data-show="!!$selectedFile"
            data-on-click="if (event.target === event.currentTarget) $selectedFile = null"
          >
            <div class="modal-content" data-if="$selectedFile">
              <button class="modal-close" data-on-click="$selectedFile = null" aria-label="Close">
                ✕
              </button>
              <div data-if="$selectedFile?.type === 'image'">
                <img
                  data-attr-src="$selectedFile?.url"
                  data-attr-alt="$selectedFile?.name"
                  class="max-w-full max-h-[80vh] mx-auto"
                />
              </div>
              <div data-if="$selectedFile?.type === 'video'">
                <video
                  data-attr-src="$selectedFile?.url"
                  controls
                  autoplay
                  class="max-w-full max-h-[80vh] mx-auto"
                />
              </div>
              <div data-if="$selectedFile?.type === 'audio'">
                <div class="audio-player">
                  <p class="text-xl mb-4" data-text="$selectedFile?.name"></p>
                  <audio
                    data-attr-src="$selectedFile?.url"
                    controls="controls"
                    autoplay={true}
                    class="w-full"
                  />
                </div>
              </div>
              <div data-if="$selectedFile?.type === 'pdf' || $selectedFile?.type === 'epub'">
                <div class="document-viewer">
                  <p class="text-xl mb-4" data-text="$selectedFile?.name"></p>
                  <a
                    data-attr-href="$selectedFile?.type === 'epub' ? '/reader/open/' + $selectedFile?.id : $selectedFile?.url"
                    class="btn-primary"
                    target="_blank"
                  >
                    Open Document
                  </a>
                </div>
              </div>
              <div class="modal-footer">
                <p class="text-sm" data-text="$selectedFile?.name"></p>
                <p class="text-xs text-gray-500">
                  <span data-text="$selectedFile?.size ? formatFileSize($selectedFile?.size) : ''"></span>
                  <span data-if="$selectedFile?.modified"> • </span>
                  <span data-text="$selectedFile?.modified ? new Date($selectedFile?.modified).toLocaleString() : ''"></span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <style>{`
        .media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        
        @media (min-width: 640px) {
          .media-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          }
        }
        
        .media-card {
          background: white;
          border: 2px solid #111;
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .media-card:hover {
          transform: translateY(-2px);
          box-shadow: 4px 4px 0 #111;
        }
        
        .media-thumbnail {
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
          background: #f5f5f5;
        }
        
        .media-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .video-thumbnail {
          position: relative;
        }
        
        .video-thumbnail video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .video-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.3);
          pointer-events: none;
        }
        
        .media-placeholder {
          width: 100%;
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
          cursor: pointer;
          transition: opacity 0.2s;
        }
        
        .media-placeholder:hover {
          opacity: 0.9;
        }
        
        .file-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }
        
        .file-info {
          text-align: center;
          padding: 0 1rem;
        }
        
        .file-name {
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        
        .file-size {
          font-size: 0.75rem;
          color: #666;
        }
        
        .media-caption {
          padding: 0.75rem;
          border-top: 1px solid #e0e0e0;
        }
        
        .media-modal {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          padding: 2rem;
        }
        
        .media-modal[data-show="true"] {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .modal-content {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          max-width: 90vw;
          max-height: 90vh;
          overflow: auto;
          position: relative;
        }
        
        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 2rem;
          height: 2rem;
          border: 2px solid #111;
          background: white;
          border-radius: 50%;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        
        .modal-close:hover {
          transform: scale(1.1);
        }
        
        .modal-footer {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e0e0e0;
        }
        
        .audio-player,
        .document-viewer {
          min-width: 400px;
          padding: 2rem;
          text-align: center;
        }
        
        .btn-primary {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #111;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          transition: transform 0.2s;
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
        }
      `}</style>

        <script>{`
        function formatFileSize(bytes) {
          if (!bytes) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }
      `}</script>
      </div>
    </Layout>
  );
};

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
