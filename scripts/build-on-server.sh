#!/bin/bash

# Build script that runs ON the NixOS server to create a compatible binary

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER="justin@135.181.179.143"
APP_DIR="/opt/slipbox"
BINARY_DIR="${APP_DIR}/bin"
BINARY_NAME="slipbox-server"

echo -e "${GREEN}🚀 Building Slipbox binary on NixOS server...${NC}"

# Step 1: Sync source code to server
echo -e "\n${YELLOW}📦 Syncing source code to server...${NC}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude "*.db" \
  --exclude "*.db-*" \
  ./ ${SERVER}:${APP_DIR}/

# Step 2: Build on server
echo -e "\n${YELLOW}🔨 Building binary on server...${NC}"
ssh ${SERVER} << 'ENDSSH'
    set -e
    cd /opt/slipbox
    
    # Install dependencies
    echo "Installing dependencies..."
    bun install
    
    # Build client assets
    echo "Building client assets..."
    bun run build:client
    
    # Build the binary ON NixOS with its linker paths
    echo "Building Linux binary..."
    mkdir -p bin
    NODE_ENV=production EMBED_ASSETS=true bun build src/index.ts \
      --compile \
      --outfile bin/slipbox-server
    
    chmod +x bin/slipbox-server
    
    # Test the binary
    echo "Testing binary..."
    ./bin/slipbox-server --version || echo "No version flag, but binary exists"
    
    echo "✓ Binary built successfully"
ENDSSH

# Step 3: Restart service
echo -e "\n${YELLOW}🔄 Restarting service...${NC}"
ssh ${SERVER} "sudo systemctl restart slipbox"

# Step 4: Check status
echo -e "\n${YELLOW}📊 Checking service status...${NC}"
ssh ${SERVER} << 'ENDSSH'
    sleep 2
    if systemctl is-active --quiet slipbox; then
        echo "✓ Service is running"
        curl -s -f http://localhost:3000 > /dev/null && echo "✓ App is responding" || echo "✗ App not responding"
    else
        echo "✗ Service failed to start"
        sudo journalctl -u slipbox -n 20 --no-pager
        exit 1
    fi
ENDSSH

echo -e "\n${GREEN}✅ Deployment complete!${NC}"