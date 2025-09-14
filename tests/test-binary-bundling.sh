#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing binary asset bundling...${NC}"

# Clean up any previous test artifacts
echo "Cleaning up previous test artifacts..."
rm -f dist/slipbox-test-binary
pkill -f "slipbox-test-binary" 2>/dev/null || true

# Build the binary for current platform
echo -e "${YELLOW}Building test binary...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    NODE_ENV=production bun build src/index.ts --compile --outfile dist/slipbox-test-binary
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # In CI, build with EMBED_ASSETS for production use
    NODE_ENV=production EMBED_ASSETS=true bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/slipbox-test-binary
else
    echo -e "${RED}Unsupported platform: $OSTYPE${NC}"
    exit 1
fi

# Check binary was created
if [ ! -f "dist/slipbox-test-binary" ]; then
    echo -e "${RED}❌ Binary was not created${NC}"
    exit 1
fi

# Get binary size for info
BINARY_SIZE=$(du -h dist/slipbox-test-binary | cut -f1)
echo "Binary size: $BINARY_SIZE"

# Create temporary data directory for test
TEST_DATA_DIR="/tmp/slipbox-test-binary-data-$$"
mkdir -p "$TEST_DATA_DIR"
echo "Created temporary data directory: $TEST_DATA_DIR"

# Start the binary on a test port
TEST_PORT=3456
echo -e "${YELLOW}Starting binary on port $TEST_PORT...${NC}"
SLIPBOX_DATA_DIR=$TEST_DATA_DIR PORT=$TEST_PORT ./dist/slipbox-test-binary &
BINARY_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up..."
    kill $BINARY_PID 2>/dev/null || true
    # In CI, keep the binary for deployment
    if [ "$CI" != "true" ]; then
        rm -f dist/slipbox-test-binary
    fi
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
        echo -e "${RED}❌ Server failed to start after 30 seconds${NC}"
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✓ Server started successfully${NC}"

# Test CSS is served correctly
echo -e "${YELLOW}Testing CSS bundling...${NC}"
CSS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/dist/style.css)
if [ "$CSS_RESPONSE" != "200" ]; then
    echo -e "${RED}❌ CSS not served correctly (HTTP $CSS_RESPONSE)${NC}"
    exit 1
fi

# Check CSS content is not empty
CSS_CONTENT=$(curl -s http://localhost:$TEST_PORT/dist/style.css)
if [ -z "$CSS_CONTENT" ]; then
    echo -e "${RED}❌ CSS content is empty${NC}"
    exit 1
fi

# Check CSS contains expected Tailwind classes
if ! echo "$CSS_CONTENT" | grep -q "tailwindcss"; then
    echo -e "${RED}❌ CSS doesn't contain Tailwind styles${NC}"
    exit 1
fi

echo -e "${GREEN}✓ CSS is properly bundled and served${NC}"

# Test JavaScript files
echo -e "${YELLOW}Testing JavaScript bundling...${NC}"

# Test datastar.js
JS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/dist/client/datastar.js)
if [ "$JS_RESPONSE" != "200" ]; then
    echo -e "${RED}❌ datastar.js not served correctly (HTTP $JS_RESPONSE)${NC}"
    exit 1
fi

JS_CONTENT=$(curl -s http://localhost:$TEST_PORT/dist/client/datastar.js)
if [ -z "$JS_CONTENT" ]; then
    echo -e "${RED}❌ datastar.js content is empty${NC}"
    exit 1
fi

echo -e "${GREEN}✓ datastar.js is properly bundled${NC}"

# Test inline-search.js
JS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/dist/client/inline-search.js)
if [ "$JS_RESPONSE" != "200" ]; then
    echo -e "${RED}❌ inline-search.js not served correctly (HTTP $JS_RESPONSE)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ inline-search.js is properly bundled${NC}"

# Test epub-reader.js
JS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT/dist/client/epub-reader.js)
if [ "$JS_RESPONSE" != "200" ]; then
    echo -e "${RED}❌ epub-reader.js not served correctly (HTTP $JS_RESPONSE)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ epub-reader.js is properly bundled${NC}"

# Test that login page includes CSS (either embedded or linked)
echo -e "${YELLOW}Testing login page renders with CSS...${NC}"
LOGIN_HTML=$(curl -s http://localhost:$TEST_PORT/login)
if echo "$LOGIN_HTML" | grep -q 'href="/dist/style.css' || echo "$LOGIN_HTML" | grep -q '<style>'; then
    echo -e "${GREEN}✓ Login page includes CSS${NC}"
else
    echo -e "${RED}❌ Login page doesn't include CSS (neither link nor embedded)${NC}"
    exit 1
fi

# Test complete
echo -e "${GREEN}✅ All binary bundling tests passed!${NC}"
echo "Binary successfully bundles and serves:"
echo "  - CSS (style.css)"
echo "  - JavaScript (datastar.js, inline-search.js, epub-reader.js)"
echo "  - HTML pages with proper asset links"

exit 0