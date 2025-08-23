import Html from '@kitajs/html';
import { escapeHtml } from '@kitajs/html';

import { Layout } from './Layout';
import { Header } from './Header';
import { marked } from 'marked';
import { Note } from '../types.js';

interface NotePageProps {
  note: Note;
}

export const NotePage = ({ note }: NotePageProps) => {
  const html = marked(note.content, {
    gfm: true,
    breaks: true
  }) as string;

  return (
    <Layout title="Note - Slipbox">
      <div id="app">
        <Header>
          <a href={`/edit/${note.id}`}>Edit</a>
          <button data-on-click={`if(confirm('Delete this note?')) @delete('/note/${note.id}')`}>Delete</button>
        </Header>

        <main>
          {html}
        </main>
      </div>
    </Layout>
  );
};
