import Html from '@kitajs/html';

import { Layout } from './Layout';
import { Header } from './Header';
import { Note } from '../types';

interface NotePageProps {
  note: Note;
}

export const NotePage = ({ note }: NotePageProps) => {
  return (
    <Layout title="Note - Slipbox">
      <div id="app">
        <Header>
          <a href={`/edit/${note.id}`}>Edit</a>
          <a href="/reader">Reader</a>
          <a href="/upload">Upload</a>
          <button data-on-click={`if(confirm('Delete this note?')) @delete('/note/${note.id}')`}>Delete</button>
        </Header>

        <main>
          {note.html || ''}
        </main>
      </div>
    </Layout>
  );
};
