import Html from "@kitajs/html";
import type { NoteMetadata } from "../types";
import { Layout } from "./Layout";
import { Nav } from "./Nav";

interface HomePageProps {
  notes: NoteMetadata[];
  totalPages: number;
  currentPage: number;
  query?: string;
}

export const HomePage = ({ notes, totalPages, currentPage, query = "" }: HomePageProps) => (
  <Layout title="Slipbox">
    <div id="app" class="container" data-signals-query="">
      <Nav currentPage="home" />

      <main class="min-h-[60vh]">
        <div class="mb-8">
          <input
            type="text"
            placeholder="Search notes..."
            autofocus
            class="input text-xl"
            data-bind="query"
            value={query}
            {...{
              "data-on-input__debounce.500ms":
                "@get('/search?q=' + encodeURIComponent($query)).then(() => window.history.replaceState({}, '', $query ? '/?q=' + encodeURIComponent($query) : '/'))",
            }}
          />
        </div>
        <div
          id="notes-grid"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8 notes-grid"
        >
          {notes.map((note) => {
            const hasMatchCount = "matchCount" in note;
            return (
              <a href={`/note/${note.id}`} class="no-underline text-inherit block h-full">
                <article class="border-2 border-dark bg-off-white p-6 h-full flex flex-col justify-between hover:shadow-[3px_3px_0_#111] transition-shadow">
                  <p
                    class="text-base text-dark mb-2 overflow-hidden"
                    style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;"
                  >
                    {note.content || "(empty note)"}
                  </p>
                  {hasMatchCount ? (
                    <span class="text-sm text-gray-600 italic">
                      {(note as any).matchCount} match{(note as any).matchCount !== 1 ? "es" : ""}
                    </span>
                  ) : (
                    <time class="text-sm text-gray-600 italic">
                      {note.modified.toLocaleDateString()}
                    </time>
                  )}
                </article>
              </a>
            );
          })}
        </div>

        {totalPages > 1 && (
          <nav class="flex justify-center items-center gap-4 mt-8 py-4 border-t-2 border-dark">
            {currentPage > 1 && (
              <a
                href={
                  query
                    ? `/?q=${encodeURIComponent(query)}&page=${currentPage - 1}`
                    : `/?page=${currentPage - 1}`
                }
              >
                Previous
              </a>
            )}
            <span class="font-serif">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages && (
              <a
                href={
                  query
                    ? `/?q=${encodeURIComponent(query)}&page=${currentPage + 1}`
                    : `/?page=${currentPage + 1}`
                }
              >
                Next
              </a>
            )}
          </nav>
        )}
      </main>
    </div>
  </Layout>
);
