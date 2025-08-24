import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Header } from './Header';

export const NewNotePage = () => (
  <Layout title="New Note - Slipbox">
    <div id="app" class="container" data-signals-content="''" data-signals-saving="false">
      <Header>
        <a href="/">Home</a>
        <a href="/reader">Reader</a>
        <a href="/upload">Upload</a>
        <button data-on-click="@post('/note/new')" data-attributes-disabled="$saving">
          <span data-show="!$saving">Create</span>
          <span data-show="$saving">Creating...</span>
        </button>
        <a href="/">Cancel</a>
      </Header>

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
  </Layout>
);