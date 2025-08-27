// This file embeds client assets into the compiled binary
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Map of paths to embedded content
export const embeddedAssets: Map<string, Buffer> = new Map();

// Only embed files when building for production
if (process.env.EMBED_ASSETS === 'true') {
  try {
    // Embed client JavaScript files
    embeddedAssets.set('/dist/client/datastar.js', readFileSync(join(__dirname, '../dist/client/datastar.js')));
    embeddedAssets.set('/dist/client/epub-reader.js', readFileSync(join(__dirname, '../dist/client/epub-reader.js')));
    embeddedAssets.set('/dist/client/inline-search.js', readFileSync(join(__dirname, '../dist/client/inline-search.js')));
    
    // Embed CSS
    embeddedAssets.set('/dist/style.css', readFileSync(join(__dirname, '../dist/style.css')));
    
    console.log('✅ Embedded', embeddedAssets.size, 'asset files');
  } catch (error) {
    console.error('Warning: Could not embed assets:', error);
  }
}