import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Header } from './Header';
import { NoteMetadata } from '../types';

interface HomePageProps {
  notes: NoteMetadata[];
  totalPages: number;
  currentPage: number;
}

export const HomePage = ({ notes, totalPages, currentPage }: HomePageProps) => (
  <Layout title="Slipbox">
    <div id="app">
      <Header>
        <a href="/reader">Reader</a>
        <a href="/upload">Upload</a>
        <a href="/new">New Note</a>
      </Header>

      <main>
        <div class="search-header">
          <input 
            type="text" 
            placeholder="Search notes..." 
            autofocus
            class="search-input"
          />
        </div>
        <div class="notes-grid">
          {notes.map(note => (
            <a href={`/note/${note.id}`} class="note-card-link">
              <article class="note-card">
                <p>{note.content}</p>
                <time>{note.modified.toLocaleDateString()}</time>
              </article>
            </a>
          ))}
        </div>

        {totalPages > 1 && (
          <nav class="pagination">
            {currentPage > 1 && <a href={`/?page=${currentPage - 1}`}>Previous</a>}
            <span>Page {currentPage} of {totalPages}</span>
            {currentPage < totalPages && <a href={`/?page=${currentPage + 1}`}>Next</a>}
          </nav>
        )}
      </main>
    </div>
  </Layout>
);