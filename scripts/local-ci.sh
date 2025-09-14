#!/usr/bin/env bash
set -e

# This script runs the exact same CI pipeline that GitHub Actions runs
# Use this to test changes locally before pushing

echo "================================"
echo "Running Local CI Pipeline"
echo "================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to handle errors
on_error() {
    echo -e "${RED}✗ CI Pipeline Failed at step: $1${NC}"
    exit 1
}

# Function to show success
on_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Trap errors
trap 'on_error "Unknown"' ERR

echo -e "${YELLOW}Step 1/5: Installing dependencies${NC}"
nix develop --command bun install || on_error "Installing dependencies"
on_success "Dependencies installed"
echo ""

echo -e "${YELLOW}Step 2/5: Running biome checks (formatting & linting)${NC}"
nix develop --command biome check . || on_error "Biome checks"
on_success "Biome checks passed"
echo ""

echo -e "${YELLOW}Step 3/5: Running TypeScript type check${NC}"
nix develop --command tsc --noEmit || on_error "TypeScript type check"
on_success "TypeScript checks passed"
echo ""

echo -e "${YELLOW}Step 4/5: Building application${NC}"
mkdir -p ~/.slipbox-dev
nix develop --command bun run build || on_error "Building application"
on_success "Build completed"
echo ""

echo -e "${YELLOW}Step 5/5: Running tests${NC}"
export CI=true
nix develop --command bun run test:ci || on_error "Running tests"
on_success "All tests passed"
echo ""

echo "================================"
echo -e "${GREEN}✓ CI Pipeline Completed Successfully!${NC}"
echo "================================"
echo ""
echo "Your changes are ready to push. The CI will pass on GitHub."