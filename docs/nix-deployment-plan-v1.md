# Nix Deployment Plan v1 - Slipbox & Multi-Project Infrastructure

## Current State Analysis

### Identified Issues
1. **Binary built outside Nix** - Using bun to compile, then awkwardly adding to store
2. **File-based triggers** - Touch file + watcher service for restarts (fragile)
3. **Profile manipulation** - Creating user profiles without proper Nix integration
4. **Hardcoded paths** - `/home/justin/slipbox-binary` breaks Nix principles
5. **Security compromises** - Disabled systemd hardening, broad sudo rules

## Proposed Architecture

```
GitHub Push → CI (Nix build) → Nix Store → Hydra/Deploy-rs → Service Restart
```

## Implementation Phases

### Phase 1: Fix Nix Derivation (Week 1)

#### 1.1 Create proper Bun binary derivation

```nix
# ~/configs/flake.nix additions
packages.slipbox-server = pkgs.stdenv.mkDerivation {
  pname = "slipbox-server";
  version = self.rev or "dev";
  
  src = self;
  
  nativeBuildInputs = [ pkgs.bun ];
  
  buildPhase = ''
    bun install --frozen-lockfile
    bun run build:client
    EMBED_ASSETS=true bun build src/index.ts \
      --compile --target=bun-linux-x64 \
      --outfile slipbox-server
  '';
  
  installPhase = ''
    mkdir -p $out/bin
    cp slipbox-server $out/bin/
  '';
};
```

#### 1.2 Create NixOS module

```nix
# ~/configs/modules/slipbox.nix
{ config, lib, pkgs, ... }:
let
  cfg = config.services.slipbox;
in
{
  options.services.slipbox = {
    enable = lib.mkEnableOption "Slipbox service";
    package = lib.mkOption {
      type = lib.types.package;
      description = "Slipbox package to use";
    };
    dataDir = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/slipbox";
    };
    port = lib.mkOption {
      type = lib.types.int;
      default = 3000;
    };
  };
  
  config = lib.mkIf cfg.enable {
    systemd.services.slipbox = {
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];
      
      serviceConfig = {
        Type = "simple";
        ExecStart = "${cfg.package}/bin/slipbox-server";
        Restart = "always";
        RestartSec = "10s";
        
        # Use DynamicUser for better security
        DynamicUser = true;
        StateDirectory = "slipbox";
        
        # Environment
        Environment = [
          "NODE_ENV=production"
          "SLIPBOX_DATA_DIR=${cfg.dataDir}"
          "PORT=${toString cfg.port}"
        ];
        
        # Security hardening (proper, not disabled)
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadWritePaths = [ cfg.dataDir ];
        
        # Resource limits
        MemoryMax = "512M";
        CPUQuota = "100%";
      };
    };
  };
}
```

### Phase 2: Deployment Infrastructure (Week 2)

#### 2.1 Add deploy-rs to flake

```nix
# ~/configs/flake.nix
inputs.deploy-rs.url = "github:serokell/deploy-rs";

outputs = { self, nixpkgs, deploy-rs, ... }: {
  deploy = {
    nodes.hetzner = {
      hostname = "slipbox";
      profiles.system = {
        user = "root";
        path = deploy-rs.lib.x86_64-linux.activate.nixos 
          self.nixosConfigurations.hetzner;
      };
    };
  };
  
  nixosConfigurations.hetzner = nixpkgs.lib.nixosSystem {
    system = "x86_64-linux";
    modules = [
      ./configs/hetzner/configuration.nix
      ./modules/slipbox.nix
      {
        services.slipbox = {
          enable = true;
          package = self.packages.x86_64-linux.slipbox-server;
        };
      }
    ];
  };
};
```

#### 2.2 CI workflow updates

```yaml
# ~/code/slipbox/.github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, master]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and deploy
        run: |
          # Build derivation
          nix build .#slipbox-server
          
          # Push to binary cache (optional but recommended)
          # nix copy --to "s3://your-cache" ./result
          
          # Deploy using deploy-rs
          nix run github:serokell/deploy-rs -- --remote-build
```

### Phase 3: Multi-Project Support (Week 3)

#### 3.1 Create deployment registry

```nix
# /etc/nixos/deployments.nix
{ config, lib, pkgs, ... }:
let
  deployments = {
    slipbox = {
      flakeUrl = "github:justinmoon/slipbox";
      output = "slipbox-server";
      port = 3000;
    };
    
    haven = {
      flakeUrl = "github:justinmoon/haven";
      output = "haven-server";
      port = 3001;
    };
    
    # Add more projects here
  };
in
{
  # Generate a service for each deployment
  imports = lib.mapAttrsToList (name: cfg: {
    systemd.services."app-${name}" = {
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];
      
      serviceConfig = {
        Type = "simple";
        ExecStart = "${pkgs.writeShellScript "start-${name}" ''
          exec /nix/var/nix/profiles/${name}/bin/${cfg.output}
        ''}";
        Restart = "always";
        Environment = [
          "PORT=${toString cfg.port}"
          "NODE_ENV=production"
        ];
        DynamicUser = true;
        StateDirectory = name;
      };
    };
  }) deployments;
}
```

#### 3.2 Auto-deployment service

```nix
# Auto-update service that polls for changes
systemd.services.deployment-updater = {
  serviceConfig = {
    Type = "oneshot";
    ExecStart = pkgs.writeShellScript "update-deployments" ''
      ${lib.concatStringsSep "\n" (lib.mapAttrsToList (name: cfg: ''
        echo "Checking ${name}..."
        latest=$(nix eval --raw ${cfg.flakeUrl}#rev 2>/dev/null || echo "")
        current=$(cat /var/lib/deployments/${name}/rev 2>/dev/null || echo "none")
        
        if [ -n "$latest" ] && [ "$latest" != "$current" ]; then
          echo "Updating ${name} from $current to $latest"
          
          # Build and install new version
          nix build ${cfg.flakeUrl}#${cfg.output} -o /tmp/${name}-new
          nix profile upgrade --profile /nix/var/nix/profiles/${name} /tmp/${name}-new
          
          # Record new version
          mkdir -p /var/lib/deployments/${name}
          echo "$latest" > /var/lib/deployments/${name}/rev
          
          # Restart service
          systemctl restart app-${name}
        fi
      '') deployments)}
    '';
  };
};

systemd.timers.deployment-updater = {
  wantedBy = [ "timers.target" ];
  timerConfig = {
    OnCalendar = "*/5 * * * *"; # Check every 5 minutes
    Persistent = true;
  };
};
```

### Phase 4: Production Hardening (Week 4)

#### 4.1 Binary cache setup

```nix
# Option 1: Use Cachix (easier)
nix.settings = {
  substituters = [ "https://your-cache.cachix.org" ];
  trusted-public-keys = [ "your-cache.cachix.org-1:..." ];
};

# Option 2: Self-hosted cache
services.nix-serve = {
  enable = true;
  port = 5000;
  secretKeyFile = "/var/cache-key";
};

services.nginx.virtualHosts."cache.yourdomain.com" = {
  locations."/".proxyPass = "http://localhost:5000";
  enableSSL = true;
  forceSSL = true;
};
```

#### 4.2 Rollback capability

```nix
# Keep last 5 generations per service
nix.gc = {
  automatic = true;
  dates = "weekly";
  options = "--delete-older-than 30d";
};

environment.systemPackages = [
  (pkgs.writeShellScriptBin "rollback-service" ''
    #!${pkgs.bash}/bin/bash
    service=$1
    if [ -z "$service" ]; then
      echo "Usage: rollback-service <service-name>"
      exit 1
    fi
    
    echo "Rolling back $service..."
    nix profile rollback --profile /nix/var/nix/profiles/$service
    systemctl restart app-$service
    echo "Rollback complete. Service status:"
    systemctl status app-$service --no-pager
  '')
  
  (pkgs.writeShellScriptBin "list-service-generations" ''
    #!${pkgs.bash}/bin/bash
    service=$1
    if [ -z "$service" ]; then
      echo "Available services:"
      ls /nix/var/nix/profiles/ | grep -v system
    else
      nix profile history --profile /nix/var/nix/profiles/$service
    fi
  '')
];
```

#### 4.3 Health checks and monitoring

```nix
# Health check for each service
systemd.services = lib.mapAttrs' (name: cfg: 
  lib.nameValuePair "health-check-${name}" {
    after = [ "app-${name}.service" ];
    requisite = [ "app-${name}.service" ];
    
    serviceConfig = {
      Type = "oneshot";
      ExecStart = pkgs.writeShellScript "health-check-${name}" ''
        for i in {1..30}; do
          if curl -f http://localhost:${toString cfg.port}/health 2>/dev/null; then
            echo "Service ${name} is healthy"
            exit 0
          fi
          sleep 1
        done
        echo "Service ${name} failed health check"
        exit 1
      '';
    };
  }
) deployments;

# Monitoring with Prometheus (optional)
services.prometheus = {
  enable = true;
  port = 9090;
  
  scrapeConfigs = lib.mapAttrsToList (name: cfg: {
    job_name = name;
    static_configs = [{
      targets = [ "localhost:${toString cfg.port}" ];
    }];
  }) deployments;
};
```

## Implementation Timeline

### Week 1 - Foundation
- [ ] Fix flake.nix to build proper binary derivation
- [ ] Test local builds with `nix build .#slipbox-server`
- [ ] Create basic NixOS module
- [ ] Test in VM with `nixos-rebuild build-vm`

### Week 2 - Deployment
- [ ] Set up deploy-rs on Hetzner machine
- [ ] Configure SSH keys and permissions
- [ ] Test manual deployment
- [ ] Update CI to use Nix deployment

### Week 3 - Multi-Project
- [ ] Create deployment registry system
- [ ] Add auto-update service
- [ ] Migrate existing services
- [ ] Test with 2-3 projects

### Week 4 - Production
- [ ] Set up binary cache (Cachix or self-hosted)
- [ ] Implement rollback tooling
- [ ] Add health checks
- [ ] Document procedures

### Ongoing
- [ ] Remove old hacks and workarounds
- [ ] Improve security hardening
- [ ] Add monitoring and alerting
- [ ] Performance tuning

## Benefits

1. **Atomic deployments** - Entire deployment succeeds or fails as unit
2. **Reproducible builds** - Same binary everywhere, bit-for-bit
3. **Multi-project ready** - Scales to dozens of services easily
4. **Zero-downtime deploys** - Switch symlinks, restart service
5. **Build caching** - Build once, deploy everywhere
6. **Proper security** - No sudo hacks, systemd isolation works
7. **Easy rollbacks** - Previous versions kept in profiles
8. **GitOps workflow** - Git push triggers everything

## Migration Strategy

1. Start with slipbox as pilot project
2. Keep old deployment working during transition
3. Run new system in parallel first
4. Switch over once proven stable
5. Gradually add other projects
6. Remove old infrastructure last

## Research Findings

### Existing Bun Derivation in nixpkgs
The official Bun package (`pkgs/by-name/bu/bun/package.nix`) uses:
- `stdenvNoCC.mkDerivation` for binary distribution
- Platform-specific source fetching with `passthru.sources`
- `autoPatchelfHook` for Linux binary patching
- Shell completion generation for multiple shells
- No build-from-source yet - downloads prebuilt binaries

**Key Insight**: Building Bun apps is still an open problem in nixpkgs (issue #255890). No standard `buildBunModule` exists yet. For now, we'll compile during derivation build phase.

### NixOS Module Patterns (from Miniflux)
Best practices from `nixos/modules/services/web-apps/miniflux.nix`:
1. **Options**: Use `mkEnableOption`, `mkPackageOption`, nested configs
2. **Database**: Automatic PostgreSQL setup with `createDatabaseLocally`
3. **Secrets**: Environment file support with validation
4. **Security**: Comprehensive systemd hardening (capabilities, namespaces, memory protection)
5. **Service**: Multiple units for setup vs runtime, proper dependencies

We should adopt these patterns for our slipbox module.

### What deploy-rs Does

**deploy-rs** is a deployment tool that:
1. **Builds** your NixOS configuration (can be done remotely or locally)
2. **Copies** the built system closure to target machine via SSH
3. **Activates** the new configuration (switches system profile)
4. **Rolls back** automatically if activation fails (optional)
5. **Manages** multiple deployment profiles (system, user, etc.)

**Key Benefits**:
- Atomic deployments with automatic rollback on failure
- Remote builds (build on CI, deploy closure only)
- Multi-node deployments from single flake
- Magic rollback if SSH connection lost during switch
- Profile management (separate system/user deployments)

**Alternatives**:
1. **NixOps** - More complex, handles cloud provisioning
2. **morph** - Similar to deploy-rs but less maintained
3. **colmena** - Parallel deployments, good for clusters
4. **nixos-rebuild --target-host** - Simple but no rollback safety
5. **DIY with nix copy + switch** - Maximum control, no safety nets

For your use case (single machine, multiple projects), deploy-rs provides the right balance of safety and simplicity. The automatic rollback feature is crucial when deploying to a remote server.

## Open Questions

- Binary cache: Cachix vs self-hosted?
- Monitoring: Prometheus vs simpler solution?
- Secrets management: sops-nix vs agenix?
- Multi-region: How to handle geo-distribution later?

## References

- [NixOS Manual - Writing Modules](https://nixos.org/manual/nixos/stable/#sec-writing-modules)
- [deploy-rs Documentation](https://github.com/serokell/deploy-rs)
- [Cachix Documentation](https://docs.cachix.org)
- [Example: Miniflux NixOS Service](https://github.com/NixOS/nixpkgs/blob/master/nixos/modules/services/web-apps/miniflux.nix)
- [Bun package in nixpkgs](https://github.com/NixOS/nixpkgs/blob/nixos-unstable/pkgs/by-name/bu/bun/package.nix)
- [buildBunModule request](https://github.com/NixOS/nixpkgs/issues/255890)
