import Html from '@kitajs/html';
import { Layout } from './Layout.js';
import { Header } from './Header.js';

interface EditNotePageProps {
  id: string;
  content: string;
}

export const EditNotePage = ({ id, content }: EditNotePageProps) => (
  <Layout title="Edit Note - Slipbox">
    <div 
      id="app" 
      data-signals-content={`"${content.replace(/"/g, '&quot;')}"`}
      data-signals-saving="false"
      data-on-load={`
        const draft = localStorage.getItem('draft-${id}');
        if (draft && draft !== $content && confirm('Restore unsaved draft?')) {
          $content = draft;
        }
      `}
    >
      <Header>
        <a href="/">Home</a>
        <a href="/reader">Reader</a>
        <button data-on-click={`@post('/note/${id}')`} data-attributes-disabled="$saving">
          <span data-show="!$saving">Save</span>
          <span data-show="$saving">Saving...</span>
        </button>
        <a href={`/note/${id}`}>Cancel</a>
      </Header>

      <main>
        <div class="editor">
          <textarea 
            data-bind="content"
            {...{ 'data-on-keydown.ctrl.s.prevent': `@post('/note/${id}')` }}
            {...{ 'data-on-keydown.meta.s.prevent': `@post('/note/${id}')` }}
            data-effect={`localStorage.setItem('draft-${id}', $content)`}
            autofocus
          ></textarea>
        </div>
      </main>
    </div>
  </Layout>
);