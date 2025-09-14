#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER="justin@slipbox"
APP_DIR="~/apps/slipbox"

echo -e "${YELLOW}Building application...${NC}"
bun run build

echo -e "${YELLOW}Creating deployment archive...${NC}"
tar -czf slipbox-deploy.tar.gz \
  dist/ \
  src/ \
  public/ \
  package.json \
  bun.lockb \
  tsconfig.json

echo -e "${YELLOW}Deploying to ${SERVER}...${NC}"
ssh "$SERVER" "mkdir -p $APP_DIR"
scp slipbox-deploy.tar.gz "$SERVER:$APP_DIR/"

echo -e "${YELLOW}Extracting and installing...${NC}"
ssh "$SERVER" "cd $APP_DIR && tar -xzf slipbox-deploy.tar.gz && bun install --production"

echo -e "${YELLOW}Restarting service...${NC}"
ssh "$SERVER" "sudo systemctl restart slipbox"

echo -e "${YELLOW}Cleaning up...${NC}"
rm slipbox-deploy.tar.gz
ssh "$SERVER" "rm $APP_DIR/slipbox-deploy.tar.gz"

echo -e "${GREEN}✓ Deployment complete!${NC}"
