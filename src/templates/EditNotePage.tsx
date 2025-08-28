import Html from "@kitajs/html";
import { Layout } from "./Layout";
import { Nav } from "./Nav";

interface EditNotePageProps {
  id: string;
  content: string;
}

export const EditNotePage = ({ id, content }: EditNotePageProps) => (
  <Layout title="Edit Note - Slipbox">
    <div id="app" class="container">
      <Nav currentPage="edit" />
      <div class="flex items-center gap-4 mb-4">
        <a
          href={`/note/${id}`}
          class="px-4 py-2 bg-dark text-white hover:shadow-[3px_3px_0_#111] transition-shadow"
        >
          View Note
        </a>
        <span id="save-status" class="text-sm text-gray-600"></span>
      </div>

      <main class="min-h-[60vh]">
        <div class="w-full">
          <textarea
            id="note-editor"
            class="w-full h-[80vh] font-mono text-base leading-relaxed p-4 border-2 border-dark bg-off-white resize-y focus:outline-none focus:ring-2 focus:ring-dark focus:ring-offset-2"
            autofocus
          >
            {content}
          </textarea>
        </div>
      </main>
    </div>
    <script>{`
      (function() {
        const textarea = document.getElementById('note-editor');
        const statusEl = document.getElementById('save-status');
        let saveTimeout;
        let lastSaved = textarea.value;
        
        // Check for draft on load
        const draft = localStorage.getItem('draft-${id}');
        if (draft && draft !== textarea.value && confirm('Restore unsaved draft?')) {
          textarea.value = draft;
        }
        
        // Auto-save function
        function autoSave() {
          const content = textarea.value;
          if (content === lastSaved) return;
          
          clearTimeout(saveTimeout);
          statusEl.textContent = 'Saving...';
          
          saveTimeout = setTimeout(() => {
            fetch('/note/${id}', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ content })
            })
            .then(response => {
              if (response.ok) {
                lastSaved = content;
                statusEl.textContent = 'Saved';
                localStorage.removeItem('draft-${id}');
                setTimeout(() => {
                  if (statusEl.textContent === 'Saved') {
                    statusEl.textContent = '';
                  }
                }, 2000);
              } else {
                throw new Error('Save failed');
              }
            })
            .catch(error => {
              statusEl.textContent = 'Save failed - will retry';
              statusEl.style.color = '#ef4444';
              // Keep draft in localStorage on failure
            });
          }, 1000);
        }
        
        // Save draft to localStorage
        function saveDraft() {
          localStorage.setItem('draft-${id}', textarea.value);
        }
        
        textarea.addEventListener('input', () => {
          autoSave();
          saveDraft();
        });
      })();
    `}</script>
  </Layout>
);
