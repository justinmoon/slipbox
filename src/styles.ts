import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// This runs at compile time when using bun build --compile
let EMBEDDED_CSS: string | null = null;

// In production, embed the CSS file content at build time
if (process.env.NODE_ENV === 'production') {
  // Try multiple possible locations for the CSS file
  const possiblePaths = [
    './dist/style.css',
    join(process.cwd(), 'dist', 'style.css'),
  ];
  
  for (const cssPath of possiblePaths) {
    if (existsSync(cssPath)) {
      EMBEDDED_CSS = readFileSync(cssPath, 'utf-8');
      console.log(`✅ CSS embedded from ${cssPath} (${(EMBEDDED_CSS.length / 1024).toFixed(2)} KB)`);
      break;
    }
  }
  
  if (!EMBEDDED_CSS) {
    console.warn('⚠️  Warning: Could not find style.css to embed. CSS will be served as a separate file.');
  }
}

export { EMBEDDED_CSS };