import Html from '@kitajs/html';
import { Layout } from './Layout.js';

interface EpubReaderPageProps {
  bookName: string;
  bookUrl: string;
}

export const EpubReaderPage = ({ bookName, bookUrl }: EpubReaderPageProps) => (
  <Layout title={`Reading: ${bookName}`}>
    <div id="app">
      <div id="epub-reader-container"></div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3/dist/epub.js"></script>
    <script src="/static/epub-reader.js"></script>
    <script>{`
      // Initialize the reader when page loads
      window.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('epub-reader-container');
        const reader = document.createElement('epub-reader');
        container.appendChild(reader);
        reader.loadBook('${bookUrl}');
      });
    `}</script>
  </Layout>
);