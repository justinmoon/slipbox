#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Rolling back Slipbox to previous version...${NC}"

# Check if running on the server
if [[ ! -f /nix/var/nix/profiles/slipbox/bin/slipbox ]]; then
    echo -e "${RED}Error: This script should be run on the production server${NC}"
    exit 1
fi

# Rollback the profile
echo -e "${YELLOW}Rolling back Nix profile...${NC}"
sudo nix profile rollback --profile /nix/var/nix/profiles/slipbox

# Restart the service
echo -e "${YELLOW}Restarting Slipbox service...${NC}"
sudo systemctl restart slipbox

# Wait for service to start
sleep 2

# Check service status
if sudo systemctl is-active --quiet slipbox; then
    echo -e "${GREEN}✓ Service is running${NC}"
    
    # Verify health check
    if curl -fsS http://localhost:3000/ >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        echo -e "${GREEN}✅ Rollback successful!${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        echo -e "${YELLOW}Recent logs:${NC}"
        sudo journalctl -u slipbox -n 20 --no-pager
        exit 1
    fi
else
    echo -e "${RED}❌ Service failed to start${NC}"
    echo -e "${YELLOW}Recent logs:${NC}"
    sudo journalctl -u slipbox -n 20 --no-pager
    exit 1
fi