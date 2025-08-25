import Html from '@kitajs/html';
import { Layout } from './Layout';
import { Nav, NavScript } from './Nav';

interface EpubFile {
  id: string;
  name: string;
  size: number;
  modified: Date;
}

interface ReaderPageProps {
  epubFiles: EpubFile[];
}

export const ReaderPage = ({ epubFiles }: ReaderPageProps) => (
  <Layout title="Slipbox Reader">
    <div id="app" class="container">
      <Nav currentPage="reader" />

      <div id="library" class="min-h-[60vh]">
        <h2 class="text-3xl font-bold mb-6 pb-2 border-b-2 border-dark">Your Library</h2>
        {epubFiles.length === 0 ? (
          <p class="text-center italic text-gray-600 py-8">No EPUB files found. Upload some using the Upload page.</p>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {epubFiles.map(book => (
              <div class="border-2 border-dark bg-off-white p-6 cursor-pointer hover:shadow-[3px_3px_0_#111] transition-shadow" data-on-click={`@get('/reader/open/${encodeURIComponent(book.id)}')`}>
                <h3 class="text-xl font-bold mb-2">{book.name}</h3>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>{(book.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span class="italic">{book.modified.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    <NavScript />
  </Layout>
);