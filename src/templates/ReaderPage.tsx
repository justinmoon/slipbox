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
              <a href={`/reader/book/${encodeURIComponent(book.name)}`} class="book-card-link" style="text-decoration: none; color: inherit;">
                <div class="book-card" style="cursor: pointer;">
                  <h3>{book.name}</h3>
                  <div class="book-meta">
                    <span class="book-size">{(book.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span class="book-date">{book.modified.toLocaleDateString()}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  </Layout>
);