#!/bin/bash
set -euo pipefail

# Restore script for Slipbox backups from Backblaze B2

# Load environment variables
if [ -f /etc/slipbox-backup.env ]; then
    set -a
    source /etc/slipbox-backup.env
    set +a
else
    echo "Error: /etc/slipbox-backup.env not found"
    exit 1
fi

# Export for restic
export B2_ACCOUNT_ID
export B2_ACCOUNT_KEY
export RESTIC_REPOSITORY
export RESTIC_PASSWORD

echo "Slipbox Backup Restore Tool"
echo "============================"
echo ""

# List available snapshots
echo "Available snapshots:"
restic snapshots

echo ""
echo "To restore a specific snapshot:"
echo "  1. Note the snapshot ID from above"
echo "  2. Run: restic restore <snapshot-id> --target /path/to/restore"
echo ""
echo "Example:"
echo "  restic restore latest --target /tmp/restore-test"
echo "  restic restore 3bf8a6c2 --target ~/apps/slipbox-restored"
echo ""
echo "To mount snapshots for browsing:"
echo "  restic mount /mnt/restic"
echo "  (then browse files and unmount when done)"