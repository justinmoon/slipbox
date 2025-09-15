# Deployment helper tools
{ pkgs, ... }:
{
  environment.systemPackages = [
    (pkgs.writeShellScriptBin "deploy-status" ''
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
        fi
        echo ""
      done
    '')
    
    (pkgs.writeShellScriptBin "deploy-rollback" ''
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
    '')
  ];
}