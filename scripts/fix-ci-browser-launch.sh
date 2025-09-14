#!/bin/bash
# Script to fix Playwright browser launching in GitHub Actions CI on NixOS
# Run this on the Hetzner server as root or with sudo

set -e

echo "=== Fixing GitHub Actions Runner for Browser Tests ==="
echo ""

# Create override directory
echo "1. Creating systemd override directory..."
sudo mkdir -p /etc/systemd/system/github-runner-hetzner-runner.service.d

# Copy the override configuration
echo "2. Installing systemd override configuration..."
sudo tee /etc/systemd/system/github-runner-hetzner-runner.service.d/override.conf << 'EOF'
[Service]
# Remove sandbox restrictions that prevent browser launching
NoNewPrivileges=no
RestrictNamespaces=no
PrivateUsers=no
PrivateTmp=no
PrivateDevices=no
ProtectHome=no
ProtectSystem=no
SystemCallFilter=
CapabilityBoundingSet=

# Enable PAM session for proper runtime directory
PAMName=login

# Set environment variables
Environment="XDG_RUNTIME_DIR=/run/user/%U"
Environment="PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1"
Environment="PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"

# Increase resource limits for browser processes
TasksMax=infinity
LimitNOFILE=1048576
LimitNPROC=16384
OOMPolicy=continue

# Ensure we wait for systemd-logind
Wants=systemd-logind.service
After=systemd-logind.service
EOF

# Enable lingering for the github-runner user
echo "3. Enabling user lingering for github-runner..."
sudo loginctl enable-linger github-runner || true

# Create runtime directory if it doesn't exist
echo "4. Creating runtime directory..."
RUNNER_UID=$(id -u github-runner)
sudo mkdir -p /run/user/$RUNNER_UID
sudo chown github-runner:github-runner /run/user/$RUNNER_UID
sudo chmod 700 /run/user/$RUNNER_UID

# Reload systemd and restart the service
echo "5. Reloading systemd and restarting runner service..."
sudo systemctl daemon-reload
sudo systemctl restart github-runner-hetzner-runner.service

# Check the status
echo ""
echo "=== Service Status ==="
sudo systemctl status github-runner-hetzner-runner.service --no-pager | head -20

echo ""
echo "=== Verifying Configuration ==="
sudo systemctl show github-runner-hetzner-runner.service | grep -E "NoNewPrivileges|RestrictNamespaces|TasksMax|LimitNOFILE|PAMName|Environment" | head -10

echo ""
echo "=== Fix Applied Successfully ==="
echo "The GitHub Actions runner should now be able to launch browsers for Playwright tests."
echo "Try running the CI workflow again to test the fix."