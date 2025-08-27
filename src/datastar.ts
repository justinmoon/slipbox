import { readFileSync } from "fs" with { type: "macro" };

// This runs at compile time when using bun build --compile
// For development, the JS file must exist at this path
// Run `bun run build:datastar` to generate it
const EMBEDDED_DATASTAR = readFileSync('./static/datastar.min.js', 'utf-8');

export { EMBEDDED_DATASTAR };