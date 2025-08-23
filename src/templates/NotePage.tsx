import Html from '@kitajs/html';
import { Layout } from './Layout.js';
import { Header } from './Header.js';

interface NotePageProps {
  id: string;
  title: string;
  html: string;
}

export const NotePage = ({ id, title, html }: NotePageProps) => (
  <Layout title={`${title} - Slipbox`}>
    <div id="app">
      <Header>
        <a href="/">Home</a>
        <a href="/reader">Reader</a>
        <a href={`/edit/${id}`}>Edit</a>
        <button data-on-click={`if(confirm('Delete this note?')) @delete('/note/${id}')`}>Delete</button>
      </Header>

      <main>
        <article class="note-content" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  </Layout>
);