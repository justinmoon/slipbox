#!/usr/bin/env bash
set -euo pipefail

# Use a consistent directory for deployments so nix profile upgrade works
DEPLOY_DIR="/build/slipbox"
echo "🚀 Deploying to $DEPLOY_DIR"

# Sync code to build directory
hsync . "justin@135.181.179.143:$DEPLOY_DIR"

# Build and deploy
ssh justin@135.181.179.143 "cd $DEPLOY_DIR && nix build .#slipbox && ci-deploy slipbox .#slipbox"