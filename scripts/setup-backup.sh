#!/bin/bash
set -euo pipefail

# Setup script for Slipbox Backblaze B2 backups with restic
# Run this from your laptop - it will SSH to your server and set everything up

echo "Slipbox Backup Setup"
echo "===================="
echo ""

# VPS connection details
VPS_HOST="slipbox"
VPS_USER="justin"

# Test SSH connection
echo "Connecting to $VPS_USER@$VPS_HOST..."
if ! ssh -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo "Error: Cannot connect to $VPS_USER@$VPS_HOST"
    echo "Please check your SSH config and try again"
    exit 1
fi

# Get Backblaze credentials
echo ""
echo "Please enter your Backblaze B2 credentials:"
echo "(Get these from Backblaze B2 > App Keys)"
read -p "B2 Account ID (keyID): " B2_ACCOUNT_ID
read -s -p "B2 Application Key: " B2_ACCOUNT_KEY
echo ""
read -p "B2 Bucket Name: " B2_BUCKET

# Generate a secure password for restic repository
echo ""
echo "Generating secure repository password..."
RESTIC_PASSWORD=$(openssl rand -base64 32)
echo ""
echo "================================================"
echo "IMPORTANT: SAVE THIS PASSWORD!"
echo "Repository password: $RESTIC_PASSWORD"
echo "================================================"
echo ""
read -p "Press enter after you've saved the password..."

# Create the environment file content
ENV_FILE_CONTENT=$(cat << EOF
# Backblaze B2 credentials
B2_ACCOUNT_ID="$B2_ACCOUNT_ID"
B2_ACCOUNT_KEY="$B2_ACCOUNT_KEY"

# Restic repository configuration
RESTIC_REPOSITORY="b2:$B2_BUCKET:/slipbox-backup"
RESTIC_PASSWORD="$RESTIC_PASSWORD"

# Backup configuration
BACKUP_USER="$VPS_USER"
EOF
)

echo ""
echo "Setting up backup system on server..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy necessary files to server
echo "Copying files to server..."
scp -q "$SCRIPT_DIR/backup.sh" "$SCRIPT_DIR/restore-backup.sh" "$VPS_USER@$VPS_HOST:/tmp/"
scp -q "$SCRIPT_DIR/../contrib/slipbox-backup.service" "$SCRIPT_DIR/../contrib/slipbox-backup.timer" "$VPS_USER@$VPS_HOST:/tmp/"

# Run setup commands on server
ssh "$VPS_USER@$VPS_HOST" bash << 'REMOTE_SCRIPT'
set -euo pipefail

echo "Installing restic..."
if ! command -v restic &> /dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq restic
else
    echo "Restic already installed"
fi

echo "Setting up backup configuration..."

# Create environment file
sudo tee /etc/slipbox-backup.env > /dev/null << 'ENV_EOF'
PLACEHOLDER_ENV_CONTENT
ENV_EOF

# Secure the environment file
sudo chmod 600 /etc/slipbox-backup.env
sudo chown root:root /etc/slipbox-backup.env

# Install backup scripts
echo "Installing backup scripts..."
sudo cp /tmp/backup.sh /usr/local/bin/restic-backup.sh
sudo cp /tmp/restore-backup.sh /usr/local/bin/restic-restore.sh
sudo chmod 755 /usr/local/bin/restic-backup.sh
sudo chmod 755 /usr/local/bin/restic-restore.sh

# Create log directory
sudo mkdir -p /var/log/slipbox-backup
sudo chown "$USER:$USER" /var/log/slipbox-backup

# Install systemd services
echo "Installing systemd services..."
sudo cp /tmp/slipbox-backup.service /etc/systemd/system/slipbox-backup@.service
sudo cp /tmp/slipbox-backup.timer "/etc/systemd/system/slipbox-backup@$USER.timer"

# Clean up temp files
rm -f /tmp/backup.sh /tmp/restore-backup.sh /tmp/slipbox-backup.service /tmp/slipbox-backup.timer

# Reload systemd
sudo systemctl daemon-reload

# Enable and start the timer
echo "Enabling backup timer..."
sudo systemctl enable "slipbox-backup@$USER.timer"
sudo systemctl start "slipbox-backup@$USER.timer"

echo "Server setup complete!"
REMOTE_SCRIPT

# Replace placeholder with actual environment content using a more robust method
ssh "$VPS_USER@$VPS_HOST" "sudo bash -c 'cat > /etc/slipbox-backup.env << EOF
$ENV_FILE_CONTENT
EOF
chmod 640 /etc/slipbox-backup.env
chown root:$VPS_USER /etc/slipbox-backup.env'"

# Initialize repository
echo ""
echo "Initializing backup repository..."
ssh "$VPS_USER@$VPS_HOST" "sudo -E bash -c 'source /etc/slipbox-backup.env && export B2_ACCOUNT_ID B2_ACCOUNT_KEY RESTIC_REPOSITORY RESTIC_PASSWORD && restic init 2>/dev/null || echo Repository already initialized'"

# Run a test backup
echo ""
echo "Running initial backup test..."
ssh "$VPS_USER@$VPS_HOST" "sudo systemctl start slipbox-backup@$VPS_USER.service"

echo ""
echo "================================================"
echo "Setup complete!"
echo "================================================"
echo ""
echo "Backup schedule: Every 6 hours"
echo ""
echo "Useful commands (run on server):"
echo "  - Check status: systemctl status slipbox-backup@$VPS_USER.timer"
echo "  - View logs: journalctl -u slipbox-backup@$VPS_USER.service -f"
echo "  - Run backup now: sudo systemctl start slipbox-backup@$VPS_USER.service"
echo "  - List snapshots: sudo -u $VPS_USER restic-restore.sh"
echo ""
echo "IMPORTANT: Repository password saved above!"
echo "Password: $RESTIC_PASSWORD"