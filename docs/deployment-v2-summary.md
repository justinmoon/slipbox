# Nix Deployment v2 Implementation Summary

## What Was Implemented

### 1. Nix Flake Configuration
- Added `slipbox-server` package to `flake.nix` that compiles to standalone binary
- Supports both Linux (production) and Darwin (local testing)
- Uses `bun build --compile` for creating self-contained executables
- Includes version tracking via git rev

### 2. GitHub Actions Workflows

#### CI/CD Pipeline (`ci.yml`)
- **Test job**: Runs tests on PRs and pushes
- **Deploy job**: 
  - Triggers on master branch pushes only
  - Builds slipbox-server with Nix
  - Updates CI user's profile without sudo
  - Restarts service via polkit
  - Includes health checks
- **Auto-merge job**: Merges owner's PRs after tests pass

#### Rollback Workflow (`rollback.yml`)
- Manual trigger via workflow_dispatch
- Service selection (slipbox, haven)
- Uses Nix profile rollback
- Shows deployment history

### 3. Server Configuration Files

#### NixOS Modules
- `ci-user.nix`: Creates dedicated CI user with Nix trusted access
- `ci-polkit.nix`: Grants CI user permission to restart services
- `github-runner.nix`: Configures runner to run as CI user
- `deployed-app.nix`: Generic module for deploying apps from CI profiles
- `services.nix`: Defines slipbox and haven services
- `deployment-tools.nix`: Helper commands for server

### 4. Helper Scripts
- `deploy-status.sh`: Shows current deployment state
- `deploy-rollback.sh`: Manual rollback command
- Migration guide with step-by-step instructions

## How It Works

1. **Developer pushes to master** → GitHub Actions triggered
2. **CI builds** → `nix build .#slipbox-server` creates binary
3. **Deploy** → Updates `/nix/var/nix/profiles/per-user/ci/slipbox`
4. **Restart** → `systemctl restart slipbox` (via polkit, no sudo)
5. **Verify** → Health check ensures service is running

## Key Benefits

- **No sudo/root needed** - CI user owns deployment lifecycle
- **Instant deployment** - No polling or watchers
- **Clean rollbacks** - Nix profiles track all versions
- **GitHub visibility** - Everything in Actions UI
- **Simple architecture** - Single user, direct deployment

## Files Created/Modified

```
slipbox/
├── .github/workflows/
│   ├── ci.yml (modified)
│   └── rollback.yml (new)
├── configs/
│   ├── hetzner/
│   │   ├── ci-user.nix
│   │   ├── ci-polkit.nix
│   │   ├── github-runner.nix
│   │   ├── services.nix
│   │   └── deployment-tools.nix
│   └── modules/
│       └── deployed-app.nix
├── docs/
│   ├── nix-deployment-migration.md
│   └── deployment-v2-summary.md (this file)
├── scripts/
│   ├── deploy-status.sh
│   └── deploy-rollback.sh
└── flake.nix (modified)
```

## Next Steps

1. **Test locally**: `nix build .#slipbox-server`
2. **Apply server configs**: Follow migration guide
3. **Test in staging**: Deploy to test environment first
4. **Production rollout**: Gradual migration per guide

## Comparison with Previous System

| Aspect | Old (Hacky) | New (v2) |
|--------|-------------|----------|
| User | justin with sudo | Dedicated ci user |
| Deploy | Build + copy + trigger | Direct profile update |
| Permissions | Sudo everywhere | Polkit for services only |
| Speed | 5+ min delay | Instant |
| Rollback | Manual | GitHub workflow |
| Visibility | Hidden | GitHub Actions UI |