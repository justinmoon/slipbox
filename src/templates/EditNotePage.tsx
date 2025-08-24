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
      class="container"
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
        <a href="/" class="btn">Home</a>
        <a href="/reader" class="btn">Reader</a>
        <button class="btn disabled:opacity-50 disabled:cursor-not-allowed" data-on-click={`@post('/note/${id}')`} data-attributes-disabled="$saving">
          <span data-show="!$saving">Save</span>
          <span data-show="$saving">Saving...</span>
        </button>
        <a href={`/note/${id}`} class="btn">Cancel</a>
      </Header>

      <main class="min-h-[60vh]">
        <div class="w-full">
          <textarea 
            class="w-full h-[80vh] font-mono text-base leading-relaxed p-4 border-2 border-dark bg-off-white resize-y focus:outline-none focus:ring-2 focus:ring-dark focus:ring-offset-2"
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