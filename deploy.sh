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
SERVER="justin@slipbox"
APP_DIR="~/apps/slipbox"
BINARY_NAME="slipbox-server"
SERVICE_NAME="slipbox"

echo -e "${GREEN}🚀 Starting deployment to DigitalOcean...${NC}"

# Step 1: Build for Linux
echo -e "\n${YELLOW}📦 Building Linux binary...${NC}"
mkdir -p dist
bun build src/index.ts --compile --target=bun-linux-x64 --outfile dist/slipbox-linux

if [ ! -f "dist/slipbox-linux" ]; then
    echo -e "${RED}❌ Build failed! Binary not found.${NC}"
    exit 1
fi

# Get binary size for info
BINARY_SIZE=$(ls -lh dist/slipbox-linux | awk '{print $5}')
echo -e "${GREEN}✓ Built binary (${BINARY_SIZE})${NC}"

# Step 2: Compress for faster transfer
echo -e "\n${YELLOW}🗜️  Compressing binary...${NC}"
gzip -f -c dist/slipbox-linux > dist/slipbox-linux.gz
COMPRESSED_SIZE=$(ls -lh dist/slipbox-linux.gz | awk '{print $5}')
echo -e "${GREEN}✓ Compressed to ${COMPRESSED_SIZE}${NC}"

# Step 3: Transfer to server
echo -e "\n${YELLOW}📤 Uploading to server...${NC}"
scp -q dist/slipbox-linux.gz ${SERVER}:${APP_DIR}/

# Step 4: Deploy on server
echo -e "\n${YELLOW}🔄 Deploying on server...${NC}"
ssh ${SERVER} << 'ENDSSH'
    set -e
    cd ~/apps/slipbox
    
    # Backup current binary if it exists
    if [ -f slipbox-server ]; then
        cp slipbox-server slipbox-server.backup
    fi
    
    # Extract and rename new binary
    gunzip -f slipbox-linux.gz
    mv slipbox-linux slipbox-server
    chmod +x slipbox-server
    
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
        rm -f slipbox-server.backup
    else
        echo "❌ App is not responding! Check logs with: sudo journalctl -u slipbox -n 50"
        exit 1
    fi
ENDSSH

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}📊 Your app is running at:${NC}"
    echo -e "  • Local: http://167.99.112.42:3000"
    echo -e "  • HTTPS: https://slipbox.anson.click (when DNS is configured)"
    
    # Clean up is handled by gitignore on dist folder
    echo -e "\n${YELLOW}💡 Tip: Check logs with: ssh ${SERVER} 'sudo journalctl -u slipbox -f'${NC}"
else
    echo -e "\n${RED}❌ Deployment failed!${NC}"
    exit 1
fi