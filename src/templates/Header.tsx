import Html from '@kitajs/html';

interface HeaderProps {
  children?: JSX.Element | JSX.Element[];
}

export const Header = ({ children }: HeaderProps) => (
  <header class="flex justify-between items-center mb-8 pb-4 border-b-4 border-double border-dark">
    <h1 class="text-4xl font-bold">
      <a href="/" class="no-underline hover:underline">Slipbox</a>
    </h1>
    <nav class="flex gap-4">{children}</nav>
  </header>
);