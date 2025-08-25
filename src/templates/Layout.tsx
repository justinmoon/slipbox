import Html from '@kitajs/html';
import { EMBEDDED_CSS } from '../styles';

interface LayoutProps {
  title: string;
  children?: JSX.Element | JSX.Element[];
}

const isDev = process.env.NODE_ENV !== 'production';

export const Layout = ({ title, children }: LayoutProps) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      {EMBEDDED_CSS ? (
        <style>{EMBEDDED_CSS}</style>
      ) : (
        <link rel="stylesheet" href={`/static/style.css?v=${Date.now()}`} />
      )}
      <script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@main/bundles/datastar.js"></script>
      {isDev && (
        <script type="text/javascript">{`
          (function() {
            const source = new EventSource('/hot-reload-sse');
            source.addEventListener('reload', () => {
              window.location.reload();
            });
            source.onerror = () => {
              console.log('SSE connection lost, retrying...');
              setTimeout(() => window.location.reload(), 1000);
            };
          })();
        `}</script>
      )}
    </head>
    <body>{children}</body>
  </html>
);
