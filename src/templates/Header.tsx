import Html from '@kitajs/html';

interface HeaderProps {
  children?: JSX.Element | JSX.Element[];
}

export const Header = ({ children }: HeaderProps) => (
  <header>
    <h1><a href="/">Slipbox</a></h1>
    <nav>{children}</nav>
  </header>
);