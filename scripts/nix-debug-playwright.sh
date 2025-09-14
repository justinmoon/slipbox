#!/usr/bin/env bash
set -euo pipefail

# Defaults: one test file and short timeout
TEST_TARGET="${TEST:-tests/basic.spec.ts}"
: "${TIMEOUT_MS:=15000}"

echo "Running single test target: ${TEST_TARGET} (timeout ${TIMEOUT_MS}ms)"
echo "Using Chromium with CI-compatible flags"

bun install

# Minimal build required for server startup
bun run build:client

# Run Playwright test with debugging
node_modules/.bin/playwright test "$TEST_TARGET" \
  --workers=1 \
  --retries=0 \
  --timeout="$TIMEOUT_MS"