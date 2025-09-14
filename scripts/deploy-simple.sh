#!/bin/bash

# Simple deployment script that syncs source and runs with bun

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER="justin@135.181.179.143"
APP_DIR="/opt/slipbox"
DATA_DIR="/var/lib/slipbox"
SERVICE_NAME="slipbox"

echo -e "${GREEN}🚀 Starting deployment to Hetzner...${NC}"

# Step 1: Build client assets locally
echo -e "\n${YELLOW}📦 Building client assets locally...${NC}"
bun run build:client

# Step 2: Create deployment tarball
echo -e "\n${YELLOW}📦 Creating deployment package...${NC}"
tar czf /tmp/slipbox-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude="*.db" \
  --exclude="*.db-*" \
  --exclude=.env.local \
  --exclude=.env.*.local \
  --exclude=playwright-report \
  --exclude=test-results \
  --exclude=.claude \
  --exclude="dist/*.js" \
  --exclude="dist/*.gz" \
  --exclude="dist/slipbox-*" \
  --exclude=worktrees \
  .

DEPLOY_SIZE=$(ls -lh /tmp/slipbox-deploy.tar.gz | awk '{print $5}')
echo -e "${GREEN}✓ Package created: ${DEPLOY_SIZE}${NC}"

# Step 3: Upload with progress bar
echo -e "\n${YELLOW}📤 Uploading to server...${NC}"
if command -v pv &> /dev/null; then
    # Use pv for progress bar
    FILE_SIZE=$(stat -f%z /tmp/slipbox-deploy.tar.gz 2>/dev/null || stat -c%s /tmp/slipbox-deploy.tar.gz 2>/dev/null)
    pv -p -e -s ${FILE_SIZE} /tmp/slipbox-deploy.tar.gz | ssh ${SERVER} "cat > /tmp/slipbox-deploy.tar.gz"
else
    echo -e "${YELLOW}   (Install 'pv' for progress bar: brew install pv)${NC}"
    scp /tmp/slipbox-deploy.tar.gz ${SERVER}:/tmp/
fi

# Step 4: Extract on server
echo -e "\n${YELLOW}📦 Extracting on server...${NC}"
ssh ${SERVER} << ENDSSH
    set -e
    cd ${APP_DIR}
    
    # Backup existing dist/client if it exists
    if [ -d dist/client ]; then
        cp -r dist/client /tmp/client-backup
    fi
    
    # Extract new code
    tar xzf /tmp/slipbox-deploy.tar.gz
    
    # Clean up
    rm /tmp/slipbox-deploy.tar.gz
    echo "✓ Code extracted successfully"
ENDSSH

# Step 5: Install dependencies on server
echo -e "\n${YELLOW}📦 Installing dependencies on server...${NC}"
ssh ${SERVER} "cd ${APP_DIR} && bun install"

# Step 6: Restart service
echo -e "\n${YELLOW}🔄 Restarting service...${NC}"
ssh ${SERVER} "sudo systemctl restart ${SERVICE_NAME}"

# Step 7: Check status
echo -e "\n${YELLOW}📊 Checking service status...${NC}"
ssh ${SERVER} << ENDSSH
    sleep 3
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo -e "${GREEN}✓ Service is running${NC}"
        if curl -s -f http://localhost:3000 > /dev/null; then
            echo -e "${GREEN}✓ App is responding on port 3000${NC}"
        else
            echo -e "${RED}✗ App not responding${NC}"
            echo "Recent logs:"
            sudo journalctl -u ${SERVICE_NAME} -n 20 --no-pager
        fi
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        echo "Error logs:"
        sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager
        exit 1
    fi
ENDSSH

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}💡 Tip: Check logs with: ssh ${SERVER} 'sudo journalctl -u slipbox -f'${NC}"