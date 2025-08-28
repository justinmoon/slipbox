import Html from '@kitajs/html';

import { Layout } from './Layout';
import { Nav, NavScript } from './Nav';
import { Note } from '../types';
import { marked } from 'marked';

interface NotePageProps {
  note: Note;
}

export const NotePage = ({ note }: NotePageProps) => {
  // Configure marked to handle epub links (both legacy epub:// and new filesystem format)
  const renderer = {
    link(token: any): string | false {
      // In Marked v5+, the first parameter is a token object
      const href = token.href || token;
      const text = token.text || '';
      
      // Ensure href is a string
      const hrefStr = String(href || '');
      
      // Handle legacy epub:// links
      if (hrefStr && hrefStr.startsWith('epub://')) {
        // Parse the epub link: epub://fileId#cfi
        const match = hrefStr.match(/^epub:\/\/([^#]+)#(.+)$/);
        if (match) {
          const [, fileId, cfi] = match;
          // Convert to a proper web URL
          const webUrl = `/epub/${fileId}#${cfi}`;
          return `<a href="${webUrl}" class="epub-link" data-file-id="${fileId}" data-cfi="${cfi}">${text}</a>`;
        }
      }
      
      // Handle new filesystem-like format: <uuid>.epub#cfi
      const epubMatch = hrefStr.match(/^([a-f0-9-]+)\.epub#(.+)$/);
      if (epubMatch) {
        const [, fileId, cfi] = epubMatch;
        // Convert to a proper web URL
        const webUrl = `/epub/${fileId}#${cfi}`;
        return `<a href="${webUrl}" class="epub-link" data-file-id="${fileId}" data-cfi="${cfi}">${text}</a>`;
      }
      
      // Return false to use the default renderer for other links
      return false;
    }
  };
  
  marked.use({ renderer });
  const html = marked(note.content, { gfm: true, breaks: true }) as string;

  return (
    <Layout title="Note - Slipbox">
      <div id="app" class="container">
        <Nav currentPage="note" />
        <div class="flex gap-4 mb-4">
          <a href={`/edit/${note.id}`} class="px-4 py-2 bg-dark text-white hover:shadow-[3px_3px_0_#111] transition-shadow">Edit</a>
          <button 
            onclick={`if(confirm('Delete this note?')) { fetch('/note/${note.id}', { method: 'DELETE' }).then(() => window.location.href = '/'); }`}
            class="px-4 py-2 border-2 border-dark hover:shadow-[3px_3px_0_#111] transition-shadow"
          >
            Delete
          </button>
        </div>
        <main class="prose prose-lg max-w-none md:columns-2 md:gap-8 mx-auto px-4">
          {html}
        </main>
      </div>
      <NavScript />
    </Layout>
  );
};
