# Playwright CI Debugging Issue - Need Help!

## Context
I have a TypeScript/Bun project called Slipbox that uses Playwright for testing. The tests work perfectly locally and when run manually on the server, but fail in GitHub Actions CI on a self-hosted NixOS runner.

## Environment Details
- **CI Platform**: GitHub Actions with self-hosted runner
- **Runner OS**: NixOS (Hetzner server)
- **Test Framework**: Playwright 1.54.1
- **Package Manager**: Bun
- **Build System**: Nix flakes
- **Browsers Tested**: Both Chromium and Firefox fail

## The Problem
Tests fail with this error in CI:
```
Error: browserContext.newPage: Target page, context or browser has been closed
```

This happens immediately when Playwright tries to create a new page, suggesting the browser launches but immediately crashes/closes.

## What Works ✅
1. **Local testing** (macOS): `nix run .#test-one` passes
2. **Manual server testing**: SSH to server and run `nix run .#test-one` passes
3. **Direct execution as github-runner user**:
   ```bash
   sudo -u github-runner bash -c 'cd /run/github-runner/hetzner-runner/slipbox/slipbox && nix run .#test-one'
   # This PASSES!
   ```

## What Fails ❌
When GitHub Actions runs the exact same command via the workflow:
```yaml
- name: Run fast single test
  run: |
    nix run .#test-one
```

## Current Configuration

### playwright.config.ts
```typescript
projects: [
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      headless: process.env.CI ? true : undefined,
      launchOptions: {
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      },
    },
  },
]
```

### flake.nix (test-one app)
```nix
export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

# Run test
node_modules/.bin/playwright test "$TEST_TARGET" \
  --workers=1 \
  --retries=0 \
  --timeout="$TIMEOUT_MS"
```

## Things I've Tried
1. **Disabled Chromium sandbox**: Added `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu` flags
2. **Switched to Firefox**: Same error occurs
3. **Used xvfb-run**: Wrapped tests in `xvfb-run -a` for virtual display
4. **Set environment variables**:
   - `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true`
   - `PLAYWRIGHT_BROWSERS_PATH` pointing to Nix-provided browsers
   - Unset `DBUS_SESSION_BUS_ADDRESS`
5. **Changed GitHub Actions approach**:
   - Tried `nix run .#test-one`
   - Tried `nix develop --command bash -c "bun run test:ci"`
   - Both fail with same error

## Chromium Core Dump Details
When Chromium was failing earlier (before --no-sandbox), we got this stack trace:
```
sandbox::Credentials::SetCapabilitiesOnCurrentThread
→ ZygoteMain
→ "user namespaces / setuid sandbox not available" crash
```

## The Mystery 🤔
- The EXACT same command works when run manually as the github-runner user
- But fails when GitHub Actions runner service executes it
- This suggests something about the GitHub Actions execution environment is different

## System Info
```bash
# Runner service
systemctl status github-runner-hetzner-runner.service

# The service runs as github-runner user
User=github-runner
WorkingDirectory=/run/github-runner/hetzner-runner
```

## Questions
1. What could be different about how GitHub Actions runner service executes commands vs manual execution?
2. Are there any systemd service restrictions that could affect browser launching?
3. Could there be cgroup/namespace isolation in the runner service?
4. Are there any environment variables GitHub Actions sets that could interfere?
5. Should we try running the browser with even more permissive flags?

## Logs Showing the Issue
```
Running 1 test using 1 worker
Skipping host requirements validation logic because `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` env variable is set.
  ✘  1 [chromium] › tests/basic.spec.ts:16:1 › basic page load (6.9s)
  
  1) [chromium] › tests/basic.spec.ts:16:1 › basic page load
    Error: browserContext.newPage: Target page, context or browser has been closed
```

## What I Need Help With
1. Understanding why the same command works manually but not in CI
2. Debugging techniques to see what's actually happening when the browser launches
3. Potential workarounds or different approaches
4. Whether this is a Nix sandbox issue, systemd restriction, or something else

Any insights would be greatly appreciated! This has been blocking our CI for hours and we're running out of ideas.

## Repository Structure
```
slipbox/
├── .github/workflows/ci.yml  # GitHub Actions workflow
├── flake.nix                 # Nix flake configuration
├── playwright.config.ts      # Playwright configuration
├── package.json              # Dependencies (Playwright 1.54.1)
└── tests/
    └── basic.spec.ts         # Simple test that's failing
```

The test that's failing is literally just:
```typescript
test('basic page load', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Slipbox/);
});
```
