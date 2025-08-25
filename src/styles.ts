import { existsSync, readFileSync } from "fs";

// This runs at compile time when using bun build --compile
// For development, the CSS file must exist at this path
// Run `bun run build:css` to generate it
let EMBEDDED_CSS: string | null = null;

// Only try to embed CSS in production builds
if (process.env.NODE_ENV === 'production' && existsSync('./static/style.css')) {
  EMBEDDED_CSS = readFileSync('./static/style.css', 'utf-8');
}

export { EMBEDDED_CSS };