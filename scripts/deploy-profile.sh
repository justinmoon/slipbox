#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying Slipbox via Nix profile...${NC}"

# Build the binary package
echo -e "${YELLOW}Building production binary package...${NC}"
OUT=$(nix build --no-link --print-out-paths .#slipbox-binary)
echo -e "${GREEN}Built package: $OUT${NC}"

# Deploy to server
SERVER="justin@slipbox"
echo -e "${YELLOW}Deploying to $SERVER...${NC}"

# Copy the closure to the server
echo -e "${YELLOW}Copying package closure to server...${NC}"
nix copy --to "ssh://$SERVER" "$OUT"

# Install into profile and restart
echo -e "${YELLOW}Installing to profile and restarting service...${NC}"
ssh "$SERVER" "sudo /run/current-system/sw/bin/nix profile install --profile /nix/var/nix/profiles/slipbox '$OUT' && sudo systemctl restart slipbox"

# Wait for service to start
sleep 2

# Verify deployment
echo -e "${YELLOW}Verifying deployment...${NC}"
if ssh "$SERVER" "sudo systemctl is-active --quiet slipbox && curl -fsS http://localhost:3000/ >/dev/null 2>&1"; then
    echo -e "${GREEN}✓ Service is running and healthy${NC}"
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment verification failed${NC}"
    echo -e "${YELLOW}Recent logs:${NC}"
    ssh "$SERVER" "sudo journalctl -u slipbox -n 20 --no-pager"
    exit 1
fi