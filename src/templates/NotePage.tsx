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
      <div id="app" class="container">
        <Header>
          <a href={`/edit/${note.id}`} class="btn">Edit</a>
          <a href="/reader" class="btn">Reader</a>
          <button class="btn" data-on-click={`if(confirm('Delete this note?')) @delete('/note/${note.id}')`}>Delete</button>
        </Header>

        <main class="min-h-[60vh] prose prose-lg max-w-none columns-gap">
          {html}
        </main>
      </div>
    </Layout>
  );
};
