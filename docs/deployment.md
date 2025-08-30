# Deployment Configuration

## Environment Variables

Environment variables for the production deployment are configured directly in the systemd service file at `/etc/systemd/system/slipbox.service`:

```ini
[Service]
Environment="NODE_ENV=production"
Environment="SLIPBOX_DATA_DIR=/home/justin/apps/slipbox/data"
Environment="PORT=3000"
```

No separate `.env` file is needed on the production server.

## Systemd Service

The full systemd service configuration:

```ini
[Unit]
Description=Slipbox App
After=network.target

[Service]
Type=simple
User=justin
WorkingDirectory=/home/justin/apps/slipbox
ExecStart=/home/justin/apps/slipbox/slipbox-server
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="SLIPBOX_DATA_DIR=/home/justin/apps/slipbox/data"
Environment="PORT=3000"

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

## Updating Environment Variables

To change environment variables:

1. SSH to the server: `ssh justin@slipbox`
2. Edit the service file: `sudo nano /etc/systemd/system/slipbox.service`
3. Reload systemd: `sudo systemctl daemon-reload`
4. Restart the service: `sudo systemctl restart slipbox`