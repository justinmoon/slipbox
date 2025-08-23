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
    <div id="app" data-signals-search="''" data-signals-searchresults="[]" data-signals-showsearch="false">
      <Header>
        <a href="/new">New Note</a>
        <button id="search-button">Search</button>
      </Header>

      <div id="search-container" class="hidden" data-class-hidden="!$showSearch" {...{ 'data-on-click.self': "$showSearch = false" }}>
        <input 
          type="text" 
          placeholder="Search notes..." 
          data-bind="search"
          {...{ 'data-on-input.debounce_300ms': "@get('/search?q=' + encodeURIComponent($search))" }}
          {...{ 'data-on-keydown.escape': "$showSearch = false; $search = ''" }}
          autofocus
        />
        <div id="search-results" class="hidden" data-class-hidden="$searchResults.length === 0">
          <template data-for="result of $searchResults">
            <a data-attributes-href="'/note/' + $result.id" class="search-result" data-on-click="$showSearch = false">
              <h3 data-text="$result.title"></h3>
              <p data-text="$result.preview"></p>
            </a>
          </template>
        </div>
      </div>

      <main>
        <h2>All Notes</h2>
        <div class="notes-grid">
          {notes.map(note => (
            <article class="note-card">
              <h3><a href={`/note/${note.id}`}>{note.title}</a></h3>
              <p>{note.preview}</p>
              <time>{note.modified.toLocaleDateString()}</time>
            </article>
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