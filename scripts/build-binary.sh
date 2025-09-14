#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building production binary...${NC}"

# Clean up any previous build artifacts
rm -f dist/slipbox-linux dist/slipbox-darwin

# Build client assets first
echo -e "${YELLOW}Building client assets...${NC}"
bun run build:client

# Build the binary for current platform
echo -e "${YELLOW}Building binary with embedded assets...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    NODE_ENV=production EMBED_ASSETS=true bun build src/index.ts --compile --outfile dist/slipbox-darwin
    BINARY_FILE="dist/slipbox-darwin"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    NODE_ENV=production EMBED_ASSETS=true bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/slipbox-linux
    BINARY_FILE="dist/slipbox-linux"
else
    echo -e "${RED}Unsupported platform: $OSTYPE${NC}"
    exit 1
fi

# Check binary was created
if [ ! -f "$BINARY_FILE" ]; then
    echo -e "${RED}❌ Binary build failed${NC}"
    exit 1
fi

# Get binary size for info
BINARY_SIZE=$(ls -lh "$BINARY_FILE" | awk '{print $5}')
echo -e "${GREEN}✓ Built binary: $BINARY_FILE (${BINARY_SIZE})${NC}"

# If in CI, verify the binary works
if [ "$CI" = "true" ]; then
    echo -e "${YELLOW}Verifying binary in CI...${NC}"
    
    # Create temporary data directory for test
    TEST_DATA_DIR="/tmp/slipbox-test-$$"
    mkdir -p "$TEST_DATA_DIR"
    
    # Start the binary on a test port
    TEST_PORT=3456
    echo "Starting binary on port $TEST_PORT..."
    SLIPBOX_DATA_DIR=$TEST_DATA_DIR PORT=$TEST_PORT "$BINARY_FILE" &
    BINARY_PID=$!
    
    # Function to cleanup on exit
    cleanup() {
        kill $BINARY_PID 2>/dev/null || true
        rm -rf "$TEST_DATA_DIR"
    }
    trap cleanup EXIT
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:$TEST_PORT > /dev/null 2>&1; then
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Server failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
    
    echo -e "${GREEN}✓ Server started successfully${NC}"
    
    # Quick smoke test - verify critical assets are served
    echo -e "${YELLOW}Testing embedded assets...${NC}"
    
    # Test CSS
    if ! curl -s -f http://localhost:$TEST_PORT/dist/style.css > /dev/null; then
        echo -e "${RED}❌ CSS not served correctly${NC}"
        exit 1
    fi
    
    # Test JavaScript
    if ! curl -s -f http://localhost:$TEST_PORT/dist/client/datastar.js > /dev/null; then
        echo -e "${RED}❌ JavaScript not served correctly${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Embedded assets working${NC}"
    echo -e "${GREEN}✅ Binary build and verification complete!${NC}"
fi