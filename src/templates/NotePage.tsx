import Html from '@kitajs/html';

import { Layout } from './Layout';
import { Header } from './Header';
import { Note } from '../types';

interface NotePageProps {
  note: Note;
  html: string;
}

export const NotePage = ({ note, html }: NotePageProps) => {
  return (
    <Layout title="Note - Slipbox">
      <div id="app" class="container">
        <Header>
          <a href={`/edit/${note.id}`}>Edit</a>
          <a href="/reader">Reader</a>
          <a href="/upload">Upload</a>
          <button data-on-click={`if(confirm('Delete this note?')) @delete('/note/${note.id}')`}>Delete</button>
        </Header>

        <main class="prose prose-lg max-w-none md:columns-2 md:gap-8 mx-auto px-4">
          {html}
        </main>
      </div>
    </Layout>
  );
};
