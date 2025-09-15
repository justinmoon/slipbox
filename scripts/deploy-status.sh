#!/usr/bin/env bash

echo "=== Deployment Status ==="
echo ""

for service in slipbox haven; do
  if [ -L /nix/var/nix/profiles/per-user/ci/$service ]; then
    echo "📦 $service:"
    STORE_PATH=$(readlink /nix/var/nix/profiles/per-user/ci/$service)
    echo "   Profile: $STORE_PATH"
    
    if systemctl is-active --quiet $service; then
      echo "   Status: ✅ Running"
    else
      echo "   Status: ❌ Stopped"
    fi
    
    # Show last 3 generations
    echo "   History:"
    nix profile history --profile /nix/var/nix/profiles/per-user/ci/$service \
      | tail -3 | sed 's/^/      /'
  else
    echo "📦 $service: Not deployed"
  fi
  echo ""
done