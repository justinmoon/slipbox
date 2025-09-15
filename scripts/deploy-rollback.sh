#!/usr/bin/env bash

SERVICE="$1"
if [ -z "$SERVICE" ]; then
  echo "Usage: deploy-rollback <service>"
  echo "Available services: slipbox, haven"
  exit 1
fi

echo "Rolling back $SERVICE..."

# Must run as ci user or with proper permissions
sudo -u ci nix profile rollback \
  --profile /nix/var/nix/profiles/per-user/ci/$SERVICE

systemctl restart $SERVICE

echo "Rollback complete"
systemctl status $SERVICE --no-pager