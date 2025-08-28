import Html from "@kitajs/html";

interface NavProps {
  currentPage?: "home" | "reader" | "upload" | "new" | "note" | "edit" | "media";
}

export const Nav = ({ currentPage }: NavProps) => {
  const navLinks = [
    { href: "/", label: "Notes", page: "home" },
    { href: "/reader", label: "Reader", page: "reader" },
    { href: "/media", label: "Media", page: "media" },
    { href: "/upload", label: "Upload", page: "upload" },
    { href: "/new", label: "New Note", page: "new" },
    { href: "/logout", label: "Logout", page: "logout" },
  ];

  return (
    <header class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold">
        <a href="/" class="no-underline hover:underline">
          Slipbox
        </a>
      </h1>
      <nav class="flex gap-4">
        {navLinks.map((link) => (
          <a href={link.href} class={currentPage === link.page ? "font-bold underline" : ""}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
};
