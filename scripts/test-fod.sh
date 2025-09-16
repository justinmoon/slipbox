#!/usr/bin/env bash
set -euo pipefail

echo "Testing FOD build on server..."

# Sync to server
echo "Syncing code..."
rsync -av --exclude='.git' --exclude='node_modules' --exclude='result' . justin@135.181.179.143:/tmp/slipbox-test/

# Test build on server
echo "Building on server..."
ssh justin@135.181.179.143 "cd /tmp/slipbox-test && nix build .#deps 2>&1"