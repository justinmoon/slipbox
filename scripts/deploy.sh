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
echo -e "\n${YELLOW}🔧 Syncing systemd service files...${NC}"
# Compare and sync systemd service file if different
TEMP_SERVICE_FILE=$(mktemp)
ssh ${SERVER} "cat /etc/systemd/system/slipbox.service" > ${TEMP_SERVICE_FILE} 2>/dev/null || true

if [ -f "contrib/slipbox.service" ]; then
    if ! cmp -s "contrib/slipbox.service" ${TEMP_SERVICE_FILE}; then
        echo -e "${YELLOW}   Service file differs, updating on server...${NC}"
        scp contrib/slipbox.service ${SERVER}:/tmp/slipbox.service
        ssh ${SERVER} "sudo mv /tmp/slipbox.service /etc/systemd/system/slipbox.service && sudo systemctl daemon-reload"
        echo -e "${GREEN}   ✓ Service file updated${NC}"
    else
        echo -e "${GREEN}   ✓ Service file is up to date${NC}"
    fi
else
    echo -e "${RED}   ⚠ contrib/slipbox.service not found in repo${NC}"
fi
rm -f ${TEMP_SERVICE_FILE}

# Update backup service files if they exist on the server
echo -e "\n${YELLOW}🔧 Checking for backup service files...${NC}"
BACKUP_EXISTS=$(ssh ${SERVER} "ls /etc/systemd/system/slipbox-backup*.service 2>/dev/null | head -1" || echo "")

if [ -n "${BACKUP_EXISTS}" ]; then
    echo -e "${YELLOW}   Backup service detected, checking for updates...${NC}"
    
    # Determine if it's the old templated (@justin) or new non-templated version
    if ssh ${SERVER} "test -f /etc/systemd/system/slipbox-backup@.service"; then
        # Old templated version exists, need to migrate
        echo -e "${YELLOW}   Migrating from templated to non-templated backup service...${NC}"
        
        # Upload new service files
        scp contrib/slipbox-backup.service ${SERVER}:/tmp/
        scp contrib/slipbox-backup.timer ${SERVER}:/tmp/
        
        # Migrate on server
        ssh ${SERVER} << 'MIGRATE_BACKUP'
            set -e
            # Stop old timer
            sudo systemctl stop slipbox-backup@justin.timer 2>/dev/null || true
            sudo systemctl disable slipbox-backup@justin.timer 2>/dev/null || true
            
            # Install new service files
            sudo mv /tmp/slipbox-backup.service /etc/systemd/system/
            sudo mv /tmp/slipbox-backup.timer /etc/systemd/system/
            
            # Remove old templated files
            sudo rm -f /etc/systemd/system/slipbox-backup@.service
            sudo rm -f /etc/systemd/system/slipbox-backup@*.timer
            
            # Reload and start new timer
            sudo systemctl daemon-reload
            sudo systemctl enable slipbox-backup.timer
            sudo systemctl start slipbox-backup.timer
            
            echo "   ✓ Migrated to non-templated backup service"
MIGRATE_BACKUP
        echo -e "${GREEN}   ✓ Backup service migrated successfully${NC}"
        
    elif ssh ${SERVER} "test -f /etc/systemd/system/slipbox-backup.service"; then
        # Already using non-templated version, just update if needed
        TEMP_BACKUP_SERVICE=$(mktemp)
        TEMP_BACKUP_TIMER=$(mktemp)
        
        ssh ${SERVER} "cat /etc/systemd/system/slipbox-backup.service" > ${TEMP_BACKUP_SERVICE} 2>/dev/null || true
        ssh ${SERVER} "cat /etc/systemd/system/slipbox-backup.timer" > ${TEMP_BACKUP_TIMER} 2>/dev/null || true
        
        NEEDS_UPDATE=false
        
        if [ -f "contrib/slipbox-backup.service" ] && ! cmp -s "contrib/slipbox-backup.service" ${TEMP_BACKUP_SERVICE}; then
            echo -e "${YELLOW}   Backup service file differs, updating...${NC}"
            scp contrib/slipbox-backup.service ${SERVER}:/tmp/
            NEEDS_UPDATE=true
        fi
        
        if [ -f "contrib/slipbox-backup.timer" ] && ! cmp -s "contrib/slipbox-backup.timer" ${TEMP_BACKUP_TIMER}; then
            echo -e "${YELLOW}   Backup timer file differs, updating...${NC}"
            scp contrib/slipbox-backup.timer ${SERVER}:/tmp/
            NEEDS_UPDATE=true
        fi
        
        if [ "${NEEDS_UPDATE}" = true ]; then
            ssh ${SERVER} << 'UPDATE_BACKUP'
                set -e
                if [ -f /tmp/slipbox-backup.service ]; then
                    sudo mv /tmp/slipbox-backup.service /etc/systemd/system/
                fi
                if [ -f /tmp/slipbox-backup.timer ]; then
                    sudo mv /tmp/slipbox-backup.timer /etc/systemd/system/
                fi
                sudo systemctl daemon-reload
                sudo systemctl restart slipbox-backup.timer
                echo "   ✓ Backup service files updated"
UPDATE_BACKUP
            echo -e "${GREEN}   ✓ Backup service updated successfully${NC}"
        else
            echo -e "${GREEN}   ✓ Backup service files are up to date${NC}"
        fi
        
        rm -f ${TEMP_BACKUP_SERVICE} ${TEMP_BACKUP_TIMER}
    fi
else
    echo -e "${YELLOW}   No backup service found on server (run setup-backup.sh to install)${NC}"
fi

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
