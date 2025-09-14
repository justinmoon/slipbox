#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# This script runs ON the Hetzner server (via CI or directly)
# The slipbox service expects files in /opt/slipbox
DEPLOY_DIR="/opt/slipbox"

echo -e "${YELLOW}Building production release...${NC}"
bun run build

echo -e "${YELLOW}Stopping slipbox service...${NC}"
sudo systemctl stop slipbox

echo -e "${YELLOW}Deploying to ${DEPLOY_DIR}...${NC}"
# Copy all necessary files to deployment directory
sudo rsync -av --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude "*.db" \
  --exclude "*.db-*" \
  --exclude playwright-report \
  --exclude test-results \
  --exclude tests \
  --exclude .claude \
  --exclude .direnv \
  --exclude responses \
  --exclude CI_DEBUGGING_PROMPT.md \
  ./ "$DEPLOY_DIR/"

echo -e "${YELLOW}Installing production dependencies...${NC}"
cd "$DEPLOY_DIR"
sudo -u justin bun install --production

echo -e "${YELLOW}Starting slipbox service...${NC}"
sudo systemctl start slipbox

# Verify deployment
sleep 3
if systemctl is-active --quiet slipbox; then
  echo -e "${GREEN}✓ Deployment successful!${NC}"
  echo "Service status:"
  systemctl status slipbox --no-pager | head -n 5
else
  echo -e "${RED}✗ Deployment failed!${NC}"
  echo "Recent logs:"
  sudo journalctl -u slipbox -n 20 --no-pager
  exit 1
fi
