import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Nav, NavScript } from './Nav';

export const NewNotePage = () => (
  <Layout title="New Note - Slipbox">
    <div id="app" class="container" data-signals-content="''" data-signals-saving="false">
      <Nav currentPage="new" />
      <div class="flex gap-4 mb-4">
        <button data-on-click="@post('/note/new')" data-attributes-disabled="$saving" class="px-4 py-2 bg-dark text-white hover:shadow-[3px_3px_0_#111] transition-shadow">
          <span data-show="!$saving">Create Note</span>
          <span data-show="$saving">Creating...</span>
        </button>
        <a href="/" class="px-4 py-2 border-2 border-dark hover:shadow-[3px_3px_0_#111] transition-shadow">Cancel</a>
      </div>

      <main class="min-h-[60vh]">
        <div class="w-full">
          <textarea 
            class="w-full h-[80vh] font-mono text-base leading-relaxed p-4 border-2 border-dark bg-off-white resize-y focus:outline-none focus:ring-2 focus:ring-dark focus:ring-offset-2"
            data-bind="content"
            placeholder="Start writing..."
            {...{ 'data-on-keydown.ctrl.s.prevent': "@post('/note/new')" }}
            {...{ 'data-on-keydown.meta.s.prevent': "@post('/note/new')" }}
            autofocus
          ></textarea>
        </div>
      </main>
    </div>
    <NavScript />
  </Layout>
);