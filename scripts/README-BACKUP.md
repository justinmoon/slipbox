# Slipbox Backup System

Automated backup system using Restic and Backblaze B2.

## Quick Setup

1. **Create Backblaze B2 account and bucket:**
   - Sign up at [backblaze.com](https://www.backblaze.com/b2/sign-up.html)
   - Create a private bucket (e.g., `slipbox-backup`)
   - Create an App Key and save the credentials

2. **Run on your server:**
   ```bash
   cd scripts/
   sudo ./setup-backup.sh
   ```

3. **Enter your Backblaze credentials when prompted**

## What It Does

- Backs up `~/apps/slipbox` every 6 hours
- Keeps 7 daily, 4 weekly, 12 monthly snapshots
- Excludes: node_modules, .git, logs, tmp files
- Runs integrity checks weekly

## Commands

```bash
# Check backup status
systemctl status slipbox-backup@username.timer

# Run backup now
systemctl start slipbox-backup@username.service

# View logs
journalctl -u slipbox-backup@username.service -f

# List snapshots
sudo -u username restic snapshots

# Restore latest backup
sudo -u username restic restore latest --target /path/to/restore
```

## Files

- `/etc/slipbox-backup.env` - Credentials (mode 600)
- `/usr/local/bin/restic-backup.sh` - Backup script
- `/var/log/slipbox-backup/` - Log directory

## Security

- Credentials stored with restrictive permissions (600)
- Systemd service runs as non-root user
- Repository encrypted with generated password
- **SAVE YOUR REPOSITORY PASSWORD!**