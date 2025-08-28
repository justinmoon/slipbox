import Html from '@kitajs/html';
import { Layout } from './Layout.js';
import { Nav } from './Nav.js';

interface EpubReaderPageProps {
  bookName: string;
  bookUrl: string;
  fileId: string;
}

export const EpubReaderPage = ({ bookName, bookUrl, fileId }: EpubReaderPageProps) => (
  <Layout title={`Reading: ${bookName}`}>
    <div id="app">
      <Nav isHidden={true} />
      <div id="epub-reader-container"></div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3/dist/epub.js"></script>
    <script src="/dist/client/epub-reader.js"></script>
    <script>{`
      // Initialize the reader when page loads
      window.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('epub-reader-container');
        const reader = document.createElement('epub-reader');
        reader.setAttribute('file-id', '${fileId}');
        container.appendChild(reader);
        reader.loadBook('${bookUrl}');
      });
    `}</script>
  </Layout>
);