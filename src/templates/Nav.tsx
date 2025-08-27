import Html from '@kitajs/html';

interface NavProps {
  currentPage?: 'home' | 'reader' | 'upload' | 'new' | 'note' | 'edit';
  hideableClass?: string;
  isHidden?: boolean;
}

export const Nav = ({ currentPage, hideableClass = 'nav-hideable', isHidden = false }: NavProps) => {
  const navLinks = [
    { href: '/', label: 'Notes', page: 'home' },
    { href: '/reader', label: 'Reader', page: 'reader' },
    { href: '/upload', label: 'Upload', page: 'upload' },
    { href: '/new', label: 'New Note', page: 'new' },
    { href: '/logout', label: 'Logout', page: 'logout' }
  ];

  return (
    <header 
      class={`flex justify-between items-center mb-8 transition-transform duration-300 ${hideableClass} ${isHidden ? '-translate-y-full' : ''}`}
      style={isHidden ? 'display: none;' : ''}
    >
      <h1 class="text-4xl font-bold">
        <a href="/" class="no-underline hover:underline">Slipbox</a>
      </h1>
      <nav class="flex gap-4">
        {navLinks.map(link => (
          <a 
            href={link.href}
            class={currentPage === link.page ? 'font-bold underline' : ''}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
};

export const NavScript = () => (
  <script>{`
    window.toggleNav = function() {
      const nav = document.querySelector('.nav-hideable');
      if (nav) {
        const isHidden = nav.classList.contains('-translate-y-full');
        if (isHidden) {
          nav.classList.remove('-translate-y-full');
          nav.style.transform = '';
          localStorage.setItem('nav-hidden', 'false');
        } else {
          nav.classList.add('-translate-y-full');
          nav.style.transform = 'translateY(-100%)';
          localStorage.setItem('nav-hidden', 'true');
        }
      }
    };

    // Restore nav state from localStorage
    window.addEventListener('DOMContentLoaded', () => {
      const navHidden = localStorage.getItem('nav-hidden') === 'true';
      const nav = document.querySelector('.nav-hideable');
      if (nav && navHidden) {
        nav.classList.add('-translate-y-full');
        nav.style.transform = 'translateY(-100%)';
      }
    });

    // Auto-hide nav on EPUB reader pages
    window.addEventListener('DOMContentLoaded', () => {
      if (window.location.pathname.includes('/reader/open/')) {
        const nav = document.querySelector('.nav-hideable');
        if (nav && !nav.classList.contains('-translate-y-full')) {
          nav.classList.add('-translate-y-full');
          nav.style.transform = 'translateY(-100%)';
          localStorage.setItem('nav-hidden', 'true');
        }
      }
    });
  `}</script>
);