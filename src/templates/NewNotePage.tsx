import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Header } from './Header';

export const NewNotePage = () => (
  <Layout title="New Note - Slipbox">
    <div id="app" data-signals-content="''" data-signals-saving="false">
      <Header>
        <button data-on-click="@post('/note/new')" data-attributes-disabled="$saving">
          <span data-show="!$saving">Create</span>
          <span data-show="$saving">Creating...</span>
        </button>
        <a href="/">Cancel</a>
      </Header>

      <main>
        <div class="editor">
          <textarea 
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