#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}     Running CI Pipeline ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Function to run a step
run_step() {
  local step_num=$1
  local step_total=$2
  local step_name=$3
  shift 3
  
  echo -e "${YELLOW}[${step_num}/${step_total}] ${step_name}...${NC}"
  
  if "$@"; then
    echo -e "${GREEN}✓ ${step_name} passed${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}✗ ${step_name} failed${NC}"
    echo ""
    return 1
  fi
}

# Run CI steps
run_step 1 5 "Installing dependencies" \
  bun install || exit 1

run_step 2 5 "Running biome checks" \
  biome check . || exit 1

run_step 3 5 "TypeScript type checking" \
  tsc --noEmit || exit 1

run_step 4 5 "Building application" \
  bash -c "mkdir -p ~/.slipbox-dev && bun run build" || exit 1

run_step 5 5 "Running tests" \
  bun run test:ci || exit 1

echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ All CI checks passed! ${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"