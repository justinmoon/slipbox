#!/bin/bash
set -euo pipefail

# Restic backup script for Slipbox data
# This script backs up ~/apps/slipbox to Backblaze B2

# Load environment variables
if [ -f /etc/slipbox-backup.env ]; then
    set -a
    source /etc/slipbox-backup.env
    set +a
else
    echo "Error: /etc/slipbox-backup.env not found"
    echo "Please create it with your Backblaze credentials"
    exit 1
fi

# Required environment variables check
: "${B2_ACCOUNT_ID:?Need B2_ACCOUNT_ID}"
: "${B2_ACCOUNT_KEY:?Need B2_ACCOUNT_KEY}"
: "${RESTIC_REPOSITORY:?Need RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Need RESTIC_PASSWORD}"

# Export for restic
export B2_ACCOUNT_ID
export B2_ACCOUNT_KEY
export RESTIC_REPOSITORY
export RESTIC_PASSWORD

# Backup source
BACKUP_SOURCE="$HOME/apps/slipbox"

# Check if backup source exists
if [ ! -d "$BACKUP_SOURCE" ]; then
    echo "Error: Backup source $BACKUP_SOURCE does not exist"
    exit 1
fi

echo "Starting backup at $(date)"

# Initialize repository if it doesn't exist
if ! restic cat config &>/dev/null; then
    echo "Initializing restic repository..."
    restic init
else
    echo "Repository already initialized"
fi

# Run backup
echo "Backing up $BACKUP_SOURCE..."
restic backup \
    --verbose \
    --tag "slipbox" \
    --tag "auto" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude="*.log" \
    --exclude="tmp/*" \
    "$BACKUP_SOURCE"

# Prune old snapshots (keep 7 daily, 4 weekly, 12 monthly)
echo "Pruning old snapshots..."
restic forget \
    --keep-daily 7 \
    --keep-weekly 4 \
    --keep-monthly 12 \
    --prune

# Check repository integrity (run occasionally, not every backup)
if [ "$(date +%u)" = "1" ]; then  # Only on Mondays
    echo "Running repository check..."
    restic check
fi

echo "Backup completed at $(date)"