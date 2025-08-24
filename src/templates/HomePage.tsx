import Html from '@kitajs/html';
import { Layout } from './Layout.js';
import { Header } from './Header.js';
import { NoteMetadata } from '../types.js';

interface HomePageProps {
  notes: NoteMetadata[];
  totalPages: number;
  currentPage: number;
}

export const HomePage = ({ notes, totalPages, currentPage }: HomePageProps) => (
  <Layout title="Slipbox">
    <div id="app" class="container">
      <Header>
        <a href="/reader" class="btn">Reader</a>
        <a href="/new" class="btn">New Note</a>
      </Header>

      <main class="min-h-[60vh]">
        <div class="mb-8">
          <input 
            type="text" 
            placeholder="Search notes..." 
            autofocus
            class="input text-xl"
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8">
          {notes.map(note => (
            <a href={`/note/${note.id}`} class="no-underline text-dark block group">
              <article class="card h-full group-hover:shadow-[3px_3px_0_#111]">
                <p class="text-base text-left text-dark mb-2">{note.preview}</p>
                <time class="text-sm text-gray-600 italic">{note.modified.toLocaleDateString()}</time>
              </article>
            </a>
          ))}
        </div>

        {totalPages > 1 && (
          <nav class="flex justify-center items-center gap-4 mt-8 py-4 border-t-2 border-dark">
            {currentPage > 1 && <a href={`/?page=${currentPage - 1}`} class="btn">Previous</a>}
            <span class="font-serif">Page {currentPage} of {totalPages}</span>
            {currentPage < totalPages && <a href={`/?page=${currentPage + 1}`} class="btn">Next</a>}
          </nav>
        )}
      </main>
    </div>
  </Layout>
);