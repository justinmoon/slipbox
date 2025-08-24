import Html from '@kitajs/html';
import { Layout } from './Layout.js';
import { Header } from './Header.js';

interface EpubFile {
  name: string;
  path: string;
  size: number;
  modified: Date;
}

interface ReaderPageProps {
  epubFiles: EpubFile[];
}

export const ReaderPage = ({ epubFiles }: ReaderPageProps) => (
  <Layout title="Slipbox Reader">
    <div id="app" class="container">
      <Header>
        <a href="/" class="btn">Notes</a>
        <a href="/new" class="btn">New Note</a>
        <button id="search-button" class="btn">Search</button>
      </Header>

      <div id="library" class="min-h-[60vh]">
        <h2 class="text-3xl font-bold mb-6 pb-2 border-b-2 border-dark">Your Library</h2>
        {epubFiles.length === 0 ? (
          <p class="text-center italic text-gray-600 py-8">No EPUB files found. Add some to the epubs/ directory.</p>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {epubFiles.map(book => (
              <div class="card cursor-pointer" data-on-click={`@get('/reader/open/${encodeURIComponent(book.name)}')`}>
                <h3 class="text-xl font-bold mb-2">{book.name}</h3>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>{(book.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span class="italic">{book.modified.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div id="reader" class="min-h-[60vh] hidden"></div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3/dist/epub.js"></script>
    <script src="/static/epub-reader.js"></script>
  </Layout>
);