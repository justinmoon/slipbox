# Slipbox Documentation

## Development Setup

### Nix Environment
This project uses Nix flakes for reproducible development environments. The flake provides all necessary tools and dependencies.

```bash
# Enter development shell
nix develop

# Run CI pipeline locally
nix run .#ci
```

### Playwright Testing
We use a hybrid Playwright setup:
- **Test API**: `@playwright/test` npm package provides the testing API and TypeScript types
- **CLI & Browsers**: `playwright-web-flake` (via Nix) provides the CLI binary and browser management

This separation ensures:
- No duplicate browser downloads
- Consistent browser versions across environments
- Proper browser handling in NixOS/systemd contexts

The `playwright-web-flake` automatically wraps Chromium with necessary environment variables, eliminating common NixOS browser launch issues.

## CI/CD Pipeline

### Local Testing
Run the full CI pipeline locally before pushing:
```bash
nix run .#ci
```

This runs the same checks as GitHub Actions:
1. Install dependencies
2. Biome formatting/linting checks
3. TypeScript type checking
4. Build application
5. Run Playwright tests

### GitHub Actions
The CI runs on a self-hosted NixOS runner on Hetzner. The workflow:
1. Checks out code
2. Runs `nix run .#ci`
3. Uploads test results
4. Auto-merges if tests pass (for dependabot PRs)
5. Deploys to production on master branch

### Self-Hosted Runner
Located at `/hetzner/github-runner.nix`, the runner:
- Uses NixOS `services.github-runners` module
- Runs in ephemeral mode (clean environment per job)
- Has access to Docker and necessary build tools

## Deployment

### Production Deployment
The production Slipbox service runs on the same Hetzner server:
- Service config: `/hetzner/slipbox.nix`
- Runs from source with `bun run src/index.ts`
- Data stored in `/var/lib/slipbox/`
- Served via Caddy reverse proxy at slipbox.xyz

### Deployment Process
1. GitHub Actions builds and tests on push to master
2. If tests pass, deploys via rsync to `/opt/slipbox/`
3. Restarts the systemd service
4. Caddy handles SSL and reverse proxy

### Manual Deployment
For manual NixOS configuration updates:
```bash
# From the configs repo
just hetzner
```

This uses rsync + `nixos-rebuild switch` for fast incremental updates.

## Testing on Server

For debugging or testing changes directly on the server:
```bash
# Sync local changes to server
hsync  # Custom script in ~/configs/bin/

# Run CI on server
ssh justin@135.181.179.143 "cd /tmp/slipbox && nix run .#ci"
```

## Key Files

- `flake.nix` - Nix development environment and CI runner
- `playwright.config.ts` - Playwright test configuration
- `.github/workflows/ci.yml` - GitHub Actions workflow
- `/hetzner/slipbox.nix` - Production service configuration
- `/hetzner/github-runner.nix` - Self-hosted runner configuration