# NixOS GitHub Actions Self-Hosted Runner Permission Problem

## Goal
I have a NixOS server that I want to use as a CI/CD platform for all my projects. The ideal workflow is:
1. GitHub Actions runs tests on PRs
2. On merge to master, automatically deploy by:
   - Building the Nix package
   - Installing to user profile with `nix profile install`
   - Restarting the systemd service

## Current Problem
The GitHub Actions self-hosted runner cannot restart systemd services due to permission restrictions. Even with sudo configured, we get:
```
sudo: The "no new privileges" flag is set, which prevents sudo from running as root.
Failed to restart slipbox.service: Access denied
```

## What Works
- CI tests run fine
- Nix build works
- Nix profile install/remove works
- Manual deployment (SSH in and run same commands) works perfectly
- The service runs fine after manual restart

## What Doesn't Work
- GitHub runner cannot use `sudo systemctl restart <service>`
- GitHub runner cannot use `systemctl restart <service>` (access denied)
- Even with all systemd restrictions supposedly removed

## Current Configuration

### `/etc/nixos/github-runner.nix`
```nix
{ config, pkgs, lib, ... }:

{
  # Note: Runner now runs as justin user to avoid sudo permission issues

  # Enable Docker for containerized builds
  virtualisation.docker.enable = true;

  # Use the official NixOS GitHub Actions runner service
  services.github-runners = {
    hetzner-runner = {
      enable = true;
      ephemeral = false;  # Keep runner registered
      replace = true;
      name = "hetzner-runner";
      url = "https://github.com/justinmoon/slipbox";
      tokenFile = "/var/lib/github-runner-token";
      user = "justin";  # Run as justin to avoid sudo issues
      
      # Match the labels in CI workflow
      extraLabels = [ "nixos" "hetzner" ];
      
      serviceOverrides = {
        # NUCLEAR OPTION: Remove ALL systemd restrictions to get tests working
        # We can lock this down later once it's working
        
        # CRITICAL: Don't set ANY of these that force NoNewPrivileges
        # Just commenting them out completely
        # SystemCallFilter = ...;  # DON'T SET
        # SystemCallArchitectures = ...;  # DON'T SET
        # RestrictAddressFamilies = ...;  # DON'T SET
        # RestrictNamespaces = ...;  # DON'T SET
        # RestrictSUIDSGID = ...;  # DON'T SET
        # RestrictRealtime = ...;  # DON'T SET
        # LockPersonality = ...;  # DON'T SET
        # MemoryDenyWriteExecute = ...;  # DON'T SET
        # DynamicUser = ...;  # DON'T SET
        
        # These are safe to set false
        NoNewPrivileges = false;
        PrivateUsers = false;
        PrivateDevices = false;
        PrivateTmp = false;
        PrivateNetwork = false;
        ProtectHome = false;
        ProtectSystem = false;
        ProtectKernelTunables = false;
        ProtectKernelModules = false;
        ProtectKernelLogs = false;
        ProtectClock = false;
        ProtectControlGroups = false;
        ProtectHostname = false;
        
        # Resource limits - critical for browser processes
        TasksMax = "infinity";
        DefaultMemoryHigh = "infinity";
        DefaultMemoryMax = "infinity";
        LimitNOFILE = 1048576;
        LimitNPROC = 16384;
        
        # Security and sandboxing - all disabled
        RemoveIPC = false;
        UMask = "0000";
        
        # Give it root access if needed
        DynamicUser = false;
        
        # CRITICAL FOR PLAYWRIGHT: Enable PAM session for XDG runtime directory
        PAMName = "login";
        
        # Allow access to build directory for deployments
        ReadWritePaths = [ "/build" ];
        
        # Environment variables for browser tests and profile access
        Environment = [
          "XDG_RUNTIME_DIR=/run/user/%U"
          "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1"
          "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"
          "HOME=/home/justin"  # Explicitly set HOME
          "USER=justin"  # Explicitly set USER
          "NIX_PROFILES=/nix/var/nix/profiles/default /home/justin/.nix-profile"
        ];
      };
      
      # Packages available to the runner
      extraPackages = with pkgs; [
        git
        gh  # GitHub CLI for auto-merge
        curl
        rsync
        procps  # For ps command
        # Nix is already available, but we can add nix-related tools
        nixpkgs-fmt
        nil  # Nix language server
        # For headless browser testing
        xvfb-run
      ];
    };
  };

  # Create /build directory for consistent deployments
  systemd.tmpfiles.rules = [
    "d /build 0755 root root -"
    "d /build/slipbox 0755 justin users -"
  ];

  # Allow justin to manage services and deployments without password
  security.sudo.extraRules = [
    {
      users = [ "justin" ];
      commands = [
        {
          command = "${pkgs.systemd}/bin/systemctl stop slipbox";
          options = [ "NOPASSWD" "SETENV" ];
        }
        {
          command = "${pkgs.systemd}/bin/systemctl start slipbox";
          options = [ "NOPASSWD" "SETENV" ];
        }
        {
          command = "${pkgs.systemd}/bin/systemctl restart slipbox";
          options = [ "NOPASSWD" "SETENV" ];
        }
        {
          command = "${pkgs.systemd}/bin/systemctl status slipbox";
          options = [ "NOPASSWD" "SETENV" ];
        }
        # ... more sudo rules for nix commands
      ];
    }
  ];
}
```

### Example GitHub Actions Workflow
```yaml
name: CI

on:
  pull_request:
    branches: [master, main]

jobs:
  test:
    runs-on: self-hosted

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run CI
        run: |
          nix run .#ci

      - name: Build production package
        if: success()
        run: |
          nix build .#slipbox

      - name: Deploy to production
        if: success()
        run: |
          cd /build/slipbox
          
          # Build and install directly
          echo "Building slipbox..."
          nix build .#slipbox
          
          echo "Removing old installation..."
          nix profile remove slipbox 2>/dev/null || true
          
          echo "Installing new version..."
          nix profile install .#slipbox
          
          echo "Restarting service directly..."
          sudo systemctl restart slipbox  # THIS FAILS!
          # Error: sudo: The "no new privileges" flag is set
```

## What I've Tried

1. **Setting NoNewPrivileges = false** - Doesn't work, something is forcing it to true
2. **Removing all systemd restrictions** - Tried not setting SystemCallFilter, RestrictNamespaces, etc. at all (not even to empty values)
3. **Running runner as different users** - Tried both root and justin
4. **Explicit sudo rules** - Added NOPASSWD rules for systemctl commands
5. **Environment variables** - Set HOME, USER, NIX_PROFILES explicitly
6. **Using trigger files** - Created a watcher service, but it's unreliable

## Investigation Findings

From web searches, I learned that systemd forces NoNewPrivileges=true if ANY of these settings exist:
- SystemCallFilter
- SystemCallArchitectures
- RestrictAddressFamilies
- RestrictNamespaces
- PrivateDevices
- ProtectKernelTunables
- ProtectKernelModules
- MemoryDenyWriteExecute
- RestrictRealtime
- RestrictSUIDSGID
- DynamicUser
- LockPersonality

Even setting them to empty arrays/false might not be enough - they need to not be set at all.

## Questions

1. **How can I completely disable ALL systemd restrictions for the GitHub runner service?** Is there something the NixOS module is adding that I can't override?

2. **Is there a better architecture for this?** Should I:
   - Run the GitHub runner differently (not as systemd service)?
   - Use a separate deployment service that polls for changes?
   - Run CI in Docker containers instead?
   - Use a different approach entirely?

3. **Are there NixOS-specific considerations I'm missing?** Is there a more idiomatic way to have a CI server that can deploy services?

4. **Is there a way to inspect what's actually forcing NoNewPrivileges?** The systemd service seems to have restrictions I didn't explicitly set.

## Ideal Solution

I want the GitHub Actions runner to be able to:
- Build Nix packages
- Update Nix profiles
- Restart systemd services
- All without manual intervention

Basically, I want my self-hosted runner to have the same capabilities I have when SSH'd into the server.

Any suggestions for how to achieve this on NixOS?