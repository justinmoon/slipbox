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
    <div id="app">
      <Header>
        <a href="/">Notes</a>
        <a href="/new">New Note</a>
        <button id="search-button">Search</button>
      </Header>

      <div id="library" class="library-view">
        <h2>Your Library</h2>
        {epubFiles.length === 0 ? (
          <p class="no-books">No EPUB files found. Add some to the epubs/ directory.</p>
        ) : (
          <div class="books-grid">
            {epubFiles.map(book => (
              <div class="book-card" data-on-click={`@get('/reader/open/${encodeURIComponent(book.name)}')`} style="cursor: pointer;">
                <h3>{book.name}</h3>
                <div class="book-meta">
                  <span class="book-size">{(book.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span class="book-date">{book.modified.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div id="reader" class="reader-view hidden"></div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3/dist/epub.js"></script>
    <script src="/static/epub-reader.js"></script>
  </Layout>
);