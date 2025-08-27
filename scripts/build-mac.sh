#!/bin/bash

# Build script for Mac binary (local testing)
set -e

echo "📦 Building client modules..."
bun run build:client

echo "📦 Building Mac binary with embedded assets..."
EMBED_ASSETS=true bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/slipbox-mac

echo "✅ Mac binary built successfully!"
echo "Test with: SLIPBOX_DATA_DIR=/Users/justin/slipbox ./dist/slipbox-mac"