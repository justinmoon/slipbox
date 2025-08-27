import Html from '@kitajs/html';
import { EMBEDDED_CSS } from '../styles';
import { EMBEDDED_DATASTAR } from '../datastar';

interface LayoutProps {
  title: string;
  children?: JSX.Element | JSX.Element[];
}

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
      {EMBEDDED_DATASTAR ? (
        <script type="module">{EMBEDDED_DATASTAR}</script>
      ) : (
        <script type="module" src="/static/datastar.min.js"></script>
      )}
    </head>
    <body>{children}</body>
  </html>
);
