# Nix Deployment v2 Migration Guide

## Overview
This guide covers the migration from the current deployment system to the Nix v2 deployment using a dedicated CI user and direct deployment.

## Prerequisites
- NixOS server with flakes enabled
- GitHub repository with self-hosted runner
- Admin access to the server

## Migration Steps

### Phase 1: Server Preparation (Week 1)

#### 1. Create CI User
Apply the CI user configuration on your server:

```bash
# On the server
sudo cp configs/hetzner/ci-user.nix /etc/nixos/
sudo cp configs/hetzner/ci-polkit.nix /etc/nixos/
```

Add to your `/etc/nixos/configuration.nix`:
```nix
{
  imports = [
    ./ci-user.nix
    ./ci-polkit.nix
  ];
}
```

Rebuild:
```bash
sudo nixos-rebuild switch
```

#### 2. Verify CI User Setup
```bash
# Check user exists
id ci

# Test profile creation
sudo -u ci nix profile list --profile /nix/var/nix/profiles/per-user/ci/test

# Verify polkit rules
pkaction --verbose --action-id org.freedesktop.systemd1.manage-units
```

### Phase 2: Runner Migration (Week 2)

#### 1. Stop Current Runner
```bash
sudo systemctl stop github-runner
```

#### 2. Apply New Runner Configuration
```bash
sudo cp configs/hetzner/github-runner.nix /etc/nixos/
```

Update `/etc/nixos/configuration.nix`:
```nix
{
  imports = [
    # ... existing imports
    ./github-runner.nix
  ];
}
```

#### 3. Set GitHub Runner Token
```bash
# Get a new runner token from GitHub
# Go to: Settings > Actions > Runners > New self-hosted runner
echo "YOUR_GITHUB_RUNNER_TOKEN" | sudo tee /var/lib/github-runner-token
sudo chmod 600 /var/lib/github-runner-token
sudo chown ci:ci /var/lib/github-runner-token
```

#### 4. Start New Runner
```bash
sudo nixos-rebuild switch
sudo systemctl status github-runner-hetzner-runner
```

### Phase 3: Service Migration (Week 3)

#### 1. Apply Service Configuration
```bash
sudo cp -r configs/modules /etc/nixos/
sudo cp configs/hetzner/services.nix /etc/nixos/
sudo cp configs/hetzner/deployment-tools.nix /etc/nixos/
```

Update `/etc/nixos/configuration.nix`:
```nix
{
  imports = [
    # ... existing imports
    ./services.nix
    ./deployment-tools.nix
  ];
}
```

#### 2. Initial Deployment
First, manually build and deploy once:

```bash
# On your local machine
git checkout master
nix build .#slipbox-server

# Copy to server
nix copy --to ssh://ci@your-server ./result

# On server, as ci user
sudo -u ci nix profile install /nix/store/...slipbox-server... \
  --profile /nix/var/nix/profiles/per-user/ci/slipbox
```

#### 3. Update Service
```bash
sudo nixos-rebuild switch
sudo systemctl start slipbox
sudo systemctl status slipbox
```

### Phase 4: Cleanup (Week 4)

#### 1. Remove Old Deployment Files
```bash
# Remove old deployment scripts
rm -f ~/slipbox-deploy-trigger
rm -f ~/slipbox-binary

# Remove old systemd services
sudo systemctl disable --now slipbox-watcher.service || true
```

#### 2. Test Full Pipeline
1. Create a test PR with a small change
2. Watch CI run tests
3. Merge PR
4. Verify automatic deployment

#### 3. Test Rollback
```bash
# On server
deploy-status  # Check current state
deploy-rollback slipbox  # Rollback
deploy-status  # Verify rollback
```

## Verification Checklist

- [ ] CI user exists and has correct permissions
- [ ] GitHub runner runs as CI user
- [ ] Polkit rules allow service management
- [ ] Profile directory exists: `/nix/var/nix/profiles/per-user/ci/`
- [ ] Service starts from CI profile
- [ ] CI workflow builds and deploys successfully
- [ ] Rollback workflow functions correctly
- [ ] Helper scripts work (`deploy-status`, `deploy-rollback`)

## Troubleshooting

### Runner Not Starting
```bash
# Check runner logs
journalctl -u github-runner-hetzner-runner -f

# Verify token file
sudo ls -la /var/lib/github-runner-token
```

### Service Not Starting
```bash
# Check if profile exists
ls -la /nix/var/nix/profiles/per-user/ci/slipbox

# Check service logs
journalctl -u slipbox -f

# Manually test binary
/nix/var/nix/profiles/per-user/ci/slipbox/bin/slipbox-server
```

### Deployment Failing
```bash
# Check CI user permissions
sudo -u ci nix profile list --profile /nix/var/nix/profiles/per-user/ci/slipbox

# Test polkit permissions
sudo -u ci systemctl restart slipbox
```

## Rollback to Old System
If needed, you can rollback to the old deployment:

1. Stop new runner: `sudo systemctl stop github-runner-hetzner-runner`
2. Start old runner: `sudo systemctl start github-runner`
3. Restore old CI workflow: `git revert <commit>`
4. Remove CI user configurations from `/etc/nixos/configuration.nix`
5. `sudo nixos-rebuild switch`

## Benefits Achieved

✅ **No sudo required** - CI user manages deployments directly
✅ **Instant deployment** - No polling delays
✅ **Clean rollback** - Nix profiles track all versions
✅ **Visible in GitHub** - All deployment logs in Actions UI
✅ **Simplified architecture** - Single CI user owns everything
✅ **Standard Nix patterns** - Uses per-user profiles correctly