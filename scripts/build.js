#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const isDev = process.env.NODE_ENV !== "production";
const CLIENT_DIR = "./src/client";
const OUTPUT_DIR = "./dist/client";

async function getClientEntrypoints() {
  const files = await readdir(CLIENT_DIR);
  return files.filter((file) => file.endsWith(".ts")).map((file) => join(CLIENT_DIR, file));
}

async function buildClient() {
  const entrypoints = await getClientEntrypoints();

  console.log("Building client modules:", entrypoints);

  const result = await Bun.build({
    entrypoints,
    outdir: OUTPUT_DIR,
    target: "browser",
    minify: !isDev,
    splitting: true, // Enable code splitting for shared dependencies
    sourcemap: isDev ? "inline" : "external",
    naming: {
      // Use predictable names for production builds
      entry: "[name].[ext]",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
  });

  if (!result.success) {
    console.error("Build failed:", result.logs);
    process.exit(1);
  }

  console.log(`✅ Built ${result.outputs.length} files to ${OUTPUT_DIR}`);

  for (const output of result.outputs) {
    const size = (output.size / 1024).toFixed(2);
    console.log(`  - ${output.path}: ${size} KB`);
  }
}

async function buildCSS() {
  console.log("Building CSS with Tailwind...");
  const proc = Bun.spawn(
    [
      "bunx",
      "tailwindcss",
      "-i",
      "./src/input.css",
      "-o",
      "./dist/style.css",
      isDev ? "" : "--minify",
    ].filter(Boolean),
  );

  await proc.exited;
  console.log("✅ CSS build complete");
}

async function build() {
  console.log(`🚀 Building for ${isDev ? "development" : "production"}...`);

  // Build in parallel
  await Promise.all([buildClient(), buildCSS()]);

  console.log("✨ Build complete!");
}

// Run build
build().catch(console.error);
