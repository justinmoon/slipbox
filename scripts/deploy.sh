#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# This script runs ON the Hetzner server (via CI or directly)
BINARY_DIR="/opt/slipbox"
BINARY_NAME="slipbox"
SERVICE_NAME="slipbox"

# Check if we have a binary already (from CI or manual build)
if [ ! -f "dist/slipbox-linux" ]; then
  echo -e "${YELLOW}No binary found, building...${NC}"
  bash scripts/build-binary.sh
fi

if [ ! -f "dist/slipbox-linux" ]; then
  echo -e "${RED}✗ Build failed! Binary not found.${NC}"
  exit 1
fi

BINARY_SIZE=$(ls -lh dist/slipbox-linux | awk '{print $5}')
echo -e "${GREEN}✓ Built binary (${BINARY_SIZE})${NC}"

echo -e "${YELLOW}Deploying binary...${NC}"

# Binary directory should already exist and be owned by justin from NixOS config

# Backup current binary if it exists
if [ -f "$BINARY_DIR/$BINARY_NAME" ]; then
  cp "$BINARY_DIR/$BINARY_NAME" "$BINARY_DIR/$BINARY_NAME.backup"
fi

# In CI environment, we can't restart services due to NoNewPrivileges
# So just deploy the binary and let a separate process handle restarts
if [ "$CI" = "true" ]; then
  echo -e "${YELLOW}Running in CI - deploying binary only${NC}"
  
  # Remove any existing .new file from previous failed deployment
  rm -f "$BINARY_DIR/$BINARY_NAME.new"
  
  # Copy to .new file - the watcher will handle the rest
  cp dist/slipbox-linux "$BINARY_DIR/$BINARY_NAME.new" || exit 1
  chmod +x "$BINARY_DIR/$BINARY_NAME.new"
  echo -e "${GREEN}✓ Binary deployed to $BINARY_DIR/$BINARY_NAME.new${NC}"
  echo -e "${YELLOW}Note: Service restart will be handled by systemd watcher${NC}"
  exit 0
fi

# Non-CI deployment: stop, deploy, start
systemctl stop "$SERVICE_NAME"

# Deploy new binary
cp dist/slipbox-linux "$BINARY_DIR/$BINARY_NAME"
chmod +x "$BINARY_DIR/$BINARY_NAME"

# Start service 
systemctl start "$SERVICE_NAME"

# Verify deployment
sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo -e "${GREEN}✓ Service restarted successfully${NC}"
  
  # Test if app is responding
  if curl -s -f http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ App is responding on port 3000${NC}"
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    # Clean up backup after successful deployment
    rm -f "$BINARY_DIR/$BINARY_NAME.backup"
  else
    echo -e "${RED}✗ App is not responding!${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Service failed to start! Rolling back...${NC}"
  if [ -f "$BINARY_DIR/$BINARY_NAME.backup" ]; then
    mv "$BINARY_DIR/$BINARY_NAME.backup" "$BINARY_DIR/$BINARY_NAME"
    systemctl start "$SERVICE_NAME"
  fi
  journalctl -u "$SERVICE_NAME" -n 20 --no-pager
  exit 1
fi
