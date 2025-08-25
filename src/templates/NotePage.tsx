import Html from '@kitajs/html';

import { Layout } from './Layout';
import { Nav, NavScript } from './Nav';
import { Note } from '../types';

interface NotePageProps {
  note: Note;
  html: string;
}

export const NotePage = ({ note, html }: NotePageProps) => {
  return (
    <Layout title="Note - Slipbox">
      <div id="app" class="container">
        <Nav currentPage="note" />
        <div class="flex gap-4 mb-4">
          <a href={`/edit/${note.id}`} class="px-4 py-2 bg-dark text-white hover:shadow-[3px_3px_0_#111] transition-shadow">Edit</a>
          <button data-on-click={`if(confirm('Delete this note?')) @delete('/note/${note.id}')`} class="px-4 py-2 border-2 border-dark hover:shadow-[3px_3px_0_#111] transition-shadow">Delete</button>
        </div>

        <main class="prose prose-lg max-w-none md:columns-2 md:gap-8 mx-auto px-4">
          {html}
        </main>
      </div>
      <NavScript />
    </Layout>
  );
};
