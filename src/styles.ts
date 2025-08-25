import { readFileSync } from "fs" with { type: "macro" };

// This runs at compile time when using bun build --compile
// For development, the CSS file must exist at this path
// Run `bun run build:css` to generate it
const EMBEDDED_CSS = readFileSync('./static/style.css', 'utf-8');

export { EMBEDDED_CSS };