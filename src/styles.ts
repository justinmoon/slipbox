import { readFileSync } from "fs" with { type: "macro" };

// This runs at compile time when using bun build --compile
// Use absolute path since macros need statically-known values
const EMBEDDED_CSS = readFileSync('/Users/justin/code/slipbox/static/style.css', 'utf-8');

export { EMBEDDED_CSS };