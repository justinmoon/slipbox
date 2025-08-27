#!/usr/bin/env bun

import { build } from 'esbuild';
import { writeFileSync } from 'fs';

// Bundle datastar for the browser
async function bundleDatastar() {
  const result = await build({
    entryPoints: ['node_modules/@starfederation/datastar/dist/bundles/datastar.js'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    outfile: 'static/datastar.min.js',
    platform: 'browser',
    write: false,
    metafile: true
  });

  // Write the bundled file
  writeFileSync('static/datastar.min.js', result.outputFiles[0].text);
  
  console.log('Datastar bundled successfully to static/datastar.min.js');
  console.log(`Bundle size: ${(result.outputFiles[0].text.length / 1024).toFixed(2)} KB`);
}

bundleDatastar().catch(console.error);