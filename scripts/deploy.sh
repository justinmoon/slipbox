#!/bin/bash

# Deployment script for Slipbox
# Usage: ./deploy.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER="justin@167.99.112.42"
APP_DIR="~/apps/slipbox"
BINARY_NAME="slipbox-server"
SERVICE_NAME="slipbox"

echo -e "${GREEN}🚀 Starting deployment to DigitalOcean...${NC}"

# Step 1: Build client modules and CSS
echo -e "\n${YELLOW}📦 Building client modules...${NC}"
bun run build:client

# Step 2: Build for Linux with embedded assets
echo -e "\n${YELLOW}📦 Building Linux binary with embedded assets...${NC}"
mkdir -p dist
NODE_ENV=production EMBED_ASSETS=true bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/slipbox-linux

if [ ! -f "dist/slipbox-linux" ]; then
    echo -e "${RED}❌ Build failed! Binary not found.${NC}"
    exit 1
fi

# Get binary size for info
BINARY_SIZE=$(ls -lh dist/slipbox-linux | awk '{print $5}')
echo -e "${GREEN}✓ Built binary (${BINARY_SIZE})${NC}"

# Step 3: Compress for faster transfer
echo -e "\n${YELLOW}🗜️  Compressing binary...${NC}"
gzip -f -c dist/slipbox-linux > dist/slipbox-linux.gz
COMPRESSED_SIZE=$(ls -lh dist/slipbox-linux.gz | awk '{print $5}')
echo -e "${GREEN}✓ Compressed to ${COMPRESSED_SIZE}${NC}"

# Step 4: Create deployment package (binary only, assets are embedded)
echo -e "\n${YELLOW}📦 Creating deployment package...${NC}"
cp dist/slipbox-linux.gz dist/slipbox-deploy.tar.gz
DEPLOY_SIZE=$(ls -lh dist/slipbox-deploy.tar.gz | awk '{print $5}')
echo -e "${GREEN}✓ Deployment package (binary only): ${DEPLOY_SIZE}${NC}"

# Step 5: Transfer to server
echo -e "\n${YELLOW}📤 Uploading to server...${NC}"

# Check if pv is available for progress bar
if command -v pv &> /dev/null; then
    # Use pv for progress bar
    FILE_SIZE=$(stat -f%z dist/slipbox-deploy.tar.gz 2>/dev/null || stat -c%s dist/slipbox-deploy.tar.gz 2>/dev/null)
    pv -p -e -s ${FILE_SIZE} dist/slipbox-deploy.tar.gz | ssh ${SERVER} "cat > ${APP_DIR}/slipbox-deploy.tar.gz"
else
    # Fall back to scp with verbose output for some progress indication
    echo -e "${YELLOW}   (Installing 'pv' will show a progress bar: brew install pv)${NC}"
    scp -v dist/slipbox-deploy.tar.gz ${SERVER}:${APP_DIR}/ 2>&1 | grep -E "Sending file|Transferred" | while IFS= read -r line; do
        echo -e "${YELLOW}   → ${line}${NC}"
    done
    # Check if scp succeeded (since we're piping output)
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        echo -e "${RED}❌ Upload failed!${NC}"
        exit 1
    fi
fi

# Step 6: Deploy on server
echo -e "\n${YELLOW}🔄 Deploying on server...${NC}"
ssh ${SERVER} << 'ENDSSH'
    set -e
    cd ~/apps/slipbox
    
    # Backup current binary only (not the entire dist)
    if [ -f slipbox-server ]; then
        cp slipbox-server slipbox-server.backup
    fi
    
    # Extract and install new binary (assets are embedded)
    mv slipbox-deploy.tar.gz slipbox-linux.gz
    gunzip -f slipbox-linux.gz
    mv slipbox-linux slipbox-server
    chmod +x slipbox-server
    
    # Clean up deployment file
    rm -f slipbox-linux.gz 2>/dev/null || true
    
    # Restart service
    sudo systemctl restart slipbox
    
    # Wait for service to start
    sleep 2
    
    # Check if service is running
    if systemctl is-active --quiet slipbox; then
        echo "✓ Service restarted successfully"
    else
        echo "❌ Service failed to start! Rolling back..."
        if [ -f slipbox-server.backup ]; then
            mv slipbox-server.backup slipbox-server
            sudo systemctl restart slipbox
        fi
        exit 1
    fi
    
    # Test if app is responding
    if curl -s -f http://localhost:3000 > /dev/null; then
        echo "✓ App is responding on port 3000"
        echo "✓ Deployment successful"
        # Clean up backup file after successful deployment
        rm -f slipbox-server.backup
        echo "✓ Cleaned up backup file"
    else
        echo "❌ App is not responding! Check logs with: sudo journalctl -u slipbox -n 50"
        exit 1
    fi
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deployment successful!${NC}"
    
    # Clean up is handled by gitignore on dist folder
    echo -e "\n${YELLOW}💡 Tip: Check logs with: ssh ${SERVER} 'sudo journalctl -u slipbox -f'${NC}"
else
    echo -e "\n${RED}❌ Deployment failed!${NC}"
    exit 1
fi
