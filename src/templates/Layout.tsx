import Html from '@kitajs/html';

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
      <link rel="stylesheet" href="/static/style.css" />
      <script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@1.0.0-RC.5/bundles/datastar.js"></script>
      <script src="/static/search-modal.js"></script>
    </head>
    <body>{children}</body>
  </html>
);