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
    <div id="app" class="container" data-signals-query="">
      <Header>
        <a href="/reader">Reader</a>
        <a href="/upload">Upload</a>
        <a href="/new">New Note</a>
      </Header>

      <main class="min-h-[60vh]">
        <div class="mb-8">
          <input 
            type="text" 
            placeholder="Search notes..." 
            autofocus
            class="input text-xl"
            data-bind="query"
            {...{ 'data-on-input.debounce_500ms': "@get('/search?q=' + encodeURIComponent($query))" }}
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid">
          {notes.map(note => (
            <a href={`/note/${note.id}`} class="no-underline text-inherit block h-full">
              <article class="border-2 border-dark bg-off-white p-6 h-full flex flex-col justify-between hover:shadow-[3px_3px_0_#111] transition-shadow">
                <p class="text-base text-dark mb-2 overflow-hidden line-clamp-3">{note.content}</p>
                <time class="text-sm text-gray-600 italic">{note.modified.toLocaleDateString()}</time>
              </article>
            </a>
          ))}
        </div>

        {totalPages > 1 && (
          <nav class="flex justify-center items-center gap-4 mt-8 py-4 border-t-2 border-dark">
            {currentPage > 1 && <a href={`/?page=${currentPage - 1}`}>Previous</a>}
            <span class="font-serif">Page {currentPage} of {totalPages}</span>
            {currentPage < totalPages && <a href={`/?page=${currentPage + 1}`}>Next</a>}
          </nav>
        )}
      </main>
    </div>
  </Layout>
);