# Nix Deployment Plan v2 - CI User & Direct Deployment

## Overview

Simplified deployment approach using a dedicated `ci` user that owns the entire deployment lifecycle. No sudo, no root, no complex indirection - just CI building and deploying directly.

## Key Changes from v1

1. **Dedicated CI user** - GitHub runner runs as `ci` user, not `justin`
2. **User profiles** - Use Nix per-user profiles (`/nix/var/nix/profiles/per-user/ci/`)
3. **Polkit for restarts** - CI user can restart services without sudo
4. **Direct deployment** - No markers, watchers, or intermediate steps
5. **Single component** - GitHub Actions does everything

## Architecture

```
GitHub Push → GitHub Actions (ci user) → Build → Update Profile → Restart Service
                                          ↓
                                    Nix Store
                                          ↓
                              /nix/var/nix/profiles/per-user/ci/
```

## Implementation

### Phase 1: System Configuration

#### 1.1 Create CI User

```nix
# ~/configs/hetzner/ci-user.nix
{ config, lib, pkgs, ... }:
{
  # Dedicated CI user for GitHub Actions
  users.users.ci = {
    isSystemUser = true;
    group = "ci";
    home = "/var/lib/ci";
    createHome = true;
    description = "CI/CD deployment user";
    
    # SSH key for GitHub Actions (if using ssh deployment)
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3... github-actions@slipbox"
    ];
  };
  
  users.groups.ci = {};
  
  # CI user can manage deployment profiles
  nix.settings.trusted-users = [ "ci" ];
}
```

#### 1.2 Configure Polkit for Service Management

```nix
# ~/configs/hetzner/ci-polkit.nix
{ config, lib, pkgs, ... }:
{
  # Allow CI user to restart services without sudo
  security.polkit.extraConfig = ''
    polkit.addRule(function(action, subject) {
      if (action.id == "org.freedesktop.systemd1.manage-units" &&
          subject.user == "ci") {
        var unit = action.lookup("unit");
        
        // Allow managing app services only
        if (unit.match(/^(slipbox|haven|app-[a-z0-9-]+)\.service$/)) {
          return polkit.Result.YES;
        }
      }
      return polkit.Result.NO;
    });
  '';
}
```

#### 1.3 Update GitHub Runner Configuration

```nix
# ~/configs/hetzner/github-runner.nix
{ config, pkgs, lib, ... }:
{
  services.github-runners = {
    hetzner-runner = {
      enable = true;
      name = "hetzner-runner";
      url = "https://github.com/justinmoon/slipbox";
      tokenFile = "/var/lib/github-runner-token";
      
      # Run as CI user
      user = "ci";
      group = "ci";
      
      extraLabels = [ "nixos" "hetzner" "self-hosted" ];
      
      # Packages available to runner
      extraPackages = with pkgs; [
        git
        gh
        curl
        nix
        systemd
      ];
      
      serviceOverrides = {
        # Grant necessary permissions for CI operations
        PrivateDevices = lib.mkForce false;
        PrivateTmp = lib.mkForce false;
        ProtectHome = lib.mkForce false;
        RestrictNamespaces = lib.mkForce false;
        
        # Environment
        Environment = [
          "NIX_PATH=nixpkgs=/nix/var/nix/profiles/per-user/ci/channels/nixos"
        ];
      };
    };
  };
}
```

### Phase 2: Application Services

#### 2.1 Service Module Using CI Profiles

```nix
# ~/configs/modules/deployed-app.nix
{ config, lib, pkgs, ... }:
let
  cfg = config.services.deployed-app;
in
{
  options.services.deployed-app = {
    instances = lib.mkOption {
      type = lib.types.attrsOf (lib.types.submodule {
        options = {
          port = lib.mkOption {
            type = lib.types.int;
            description = "Port for the service";
          };
          
          dataDir = lib.mkOption {
            type = lib.types.str;
            default = name: "/var/lib/${name}";
            description = "Data directory for the service";
          };
          
          extraEnv = lib.mkOption {
            type = lib.types.attrsOf lib.types.str;
            default = {};
            description = "Extra environment variables";
          };
        };
      });
      default = {};
      description = "Application instances to deploy";
    };
  };
  
  config = {
    # Create a systemd service for each instance
    systemd.services = lib.mapAttrs' (name: cfg:
      lib.nameValuePair name {
        description = "${name} application service";
        wantedBy = [ "multi-user.target" ];
        after = [ "network.target" ];
        
        # Wait for profile to exist before starting
        unitConfig = {
          ConditionPathExists = "/nix/var/nix/profiles/per-user/ci/${name}/bin/${name}-server";
        };
        
        serviceConfig = {
          Type = "simple";
          Restart = "always";
          RestartSec = "10s";
          
          # Run from CI user's profile
          ExecStart = "/nix/var/nix/profiles/per-user/ci/${name}/bin/${name}-server";
          
          # Security - use dynamic user for runtime
          DynamicUser = true;
          StateDirectory = name;
          
          # Environment
          Environment = [
            "NODE_ENV=production"
            "PORT=${toString cfg.port}"
            "DATA_DIR=/var/lib/${name}"
          ] ++ (lib.mapAttrsToList (k: v: "${k}=${v}") cfg.extraEnv);
          
          # Hardening
          NoNewPrivileges = true;
          PrivateTmp = true;
          ProtectSystem = "strict";
          ProtectHome = true;
          ReadWritePaths = [ "/var/lib/${name}" ];
          
          # Resources
          MemoryMax = "512M";
          CPUQuota = "100%";
        };
      }
    ) cfg.instances;
    
    # Create data directories
    systemd.tmpfiles.rules = lib.mapAttrsToList (name: cfg:
      "d /var/lib/${name} 0750 ${name} ${name} -"
    ) cfg.instances;
  };
}
```

#### 2.2 Configure Services

```nix
# ~/configs/hetzner/services.nix
{
  imports = [ ./modules/deployed-app.nix ];
  
  services.deployed-app.instances = {
    slipbox = {
      port = 3000;
      extraEnv = {
        SLIPBOX_DATA_DIR = "/var/lib/slipbox";
      };
    };
    
    haven = {
      port = 3001;
    };
    
    # Easy to add more services
  };
}
```

### Phase 3: Application Build Configuration

#### 3.1 Slipbox Flake Updates

```nix
# ~/code/slipbox/flake.nix
{
  description = "Slipbox with CI deployment";
  
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages = {
          # Production build
          slipbox-server = pkgs.stdenv.mkDerivation {
            pname = "slipbox-server";
            version = self.rev or self.dirtyRev or "dev";
            
            src = lib.cleanSource ./.;
            
            nativeBuildInputs = with pkgs; [ bun ];
            
            buildPhase = ''
              # Install dependencies
              bun install --frozen-lockfile
              
              # Build client assets
              bun run build:client
              
              # Compile server with embedded assets
              EMBED_ASSETS=true bun build src/index.ts \
                --compile \
                --target=bun-linux-x64 \
                --outfile slipbox-server
            '';
            
            installPhase = ''
              mkdir -p $out/bin
              cp slipbox-server $out/bin/
              chmod +x $out/bin/slipbox-server
            '';
            
            # Include version info
            passthru = {
              inherit (self) rev;
            };
          };
          
          default = self.packages.${system}.slipbox-server;
        };
      }
    );
}
```

### Phase 4: CI/CD Pipeline

#### 4.1 GitHub Actions Workflow

```yaml
# ~/code/slipbox/.github/workflows/ci.yml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [master, main]
  push:
    branches: [master, main]

jobs:
  test:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      
      - name: Run tests
        run: |
          nix develop -c bun install
          nix develop -c bun test:ci
          
      - name: Type check
        run: |
          nix develop -c bunx tsc --noEmit
          
      - name: Lint
        run: |
          nix develop -c bun run lint

  deploy:
    needs: test
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    runs-on: self-hosted
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build application
        run: |
          echo "Building slipbox-server..."
          nix build .#slipbox-server
          
      - name: Deploy to production
        run: |
          # Update CI user's profile (no sudo needed)
          echo "Updating deployment profile..."
          nix profile upgrade \
            --profile /nix/var/nix/profiles/per-user/ci/slipbox \
            ./result
          
          # Restart service (works via polkit, no sudo)
          echo "Restarting service..."
          systemctl restart slipbox
          
          # Wait for service to be healthy
          echo "Waiting for service to start..."
          sleep 5
          
          # Health check
          echo "Checking service health..."
          if curl -f http://localhost:3000/health; then
            echo "✅ Deployment successful!"
          else
            echo "❌ Health check failed"
            exit 1
          fi
          
      - name: Verify deployment
        run: |
          # Check service status
          systemctl is-active slipbox
          
          # Check version
          DEPLOYED_VERSION=$(readlink /nix/var/nix/profiles/per-user/ci/slipbox)
          echo "Deployed version: $DEPLOYED_VERSION"
```

#### 4.2 Rollback Workflow

```yaml
# ~/code/slipbox/.github/workflows/rollback.yml
name: Rollback Production

on:
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to rollback'
        required: true
        default: 'slipbox'
        type: choice
        options:
          - slipbox
          - haven

jobs:
  rollback:
    runs-on: self-hosted
    steps:
      - name: Rollback deployment
        run: |
          SERVICE=${{ inputs.service }}
          
          echo "Rolling back $SERVICE..."
          
          # Rollback profile
          nix profile rollback \
            --profile /nix/var/nix/profiles/per-user/ci/$SERVICE
          
          # Restart service
          systemctl restart $SERVICE
          
          # Verify
          sleep 5
          if systemctl is-active $SERVICE; then
            echo "✅ Rollback successful"
          else
            echo "❌ Rollback failed"
            exit 1
          fi
```

### Phase 5: Helper Scripts

#### 5.1 Deployment Status Script

```nix
# ~/configs/hetzner/deployment-tools.nix
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
```

## Benefits of v2 Approach

1. **Simplicity** - Single CI user owns entire deployment
2. **No sudo** - Polkit grants specific permissions
3. **Direct deployment** - No markers, watchers, or root services
4. **Standard paths** - Uses Nix per-user profiles correctly
5. **GitHub-centric** - Everything happens in Actions, visible in UI
6. **Fast** - Deploys complete immediately after tests pass
7. **Safe** - Easy rollback, profile generations preserved
8. **Scalable** - Easy to add new services

## Migration from Current Setup

### Week 1: Preparation
- [ ] Create `ci` user on Hetzner machine
- [ ] Set up polkit rules
- [ ] Test profile management as ci user

### Week 2: Runner Migration
- [ ] Stop current runner
- [ ] Reconfigure runner as ci user
- [ ] Test builds work with ci user

### Week 3: Service Migration
- [ ] Update slipbox service to use ci profile
- [ ] Update CI workflow to use new deployment
- [ ] Test full pipeline

### Week 4: Cleanup
- [ ] Remove old deployment hacks
- [ ] Remove sudo rules
- [ ] Remove watcher services
- [ ] Document new process

## Comparison with v1

| Aspect | v1 (Polling/Watchers) | v2 (CI User) |
|--------|-----------------------|--------------|
| Complexity | High (multiple components) | Low (single user) |
| Speed | 5-minute polling delay | Instant |
| Permissions | Root services, sudo | Polkit only |
| Visibility | Hidden in systemd | GitHub Actions UI |
| Rollback | Manual | GitHub workflow |
| Debugging | Check multiple services | Single CI log |

## Future Enhancements

1. **Multi-machine** - Same CI user can deploy to multiple servers
2. **Secrets** - Use GitHub secrets + sops-nix for sensitive config
3. **Monitoring** - Add Prometheus metrics export
4. **Notifications** - Slack/Discord on deploy success/failure
5. **Canary deploys** - Deploy to staging first

## Conclusion

This v2 approach eliminates all the complexity of v1 by having the CI user directly own and manage deployments. No root access, no sudo, no watchers - just a clean, direct deployment from GitHub Actions to production.