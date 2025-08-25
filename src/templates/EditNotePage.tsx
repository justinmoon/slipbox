import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Nav, NavScript } from './Nav';

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
      <Nav currentPage="edit" />
      <div class="flex gap-4 mb-4">
        <button data-on-click={`@post('/note/${id}')`} data-attributes-disabled="$saving" class="px-4 py-2 bg-dark text-white hover:shadow-[3px_3px_0_#111] transition-shadow">
          <span data-show="!$saving">Save</span>
          <span data-show="$saving">Saving...</span>
        </button>
        <a href={`/note/${id}`} class="px-4 py-2 border-2 border-dark hover:shadow-[3px_3px_0_#111] transition-shadow">Cancel</a>
      </div>

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
    <NavScript />
  </Layout>
);