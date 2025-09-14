This is a fascinating CI debugging puzzle! The fact that it works manually as the `github-runner` user but fails when executed by the GitHub Actions runner service strongly suggests environmental differences in the systemd service context. Let me help you troubleshoot this systematically.

## The Core Issue

The key clue is that manual execution as `github-runner` works, but the systemd service execution fails. This points to systemd service restrictions or missing environment context.

## Debugging Strategy

### 1. **Capture the Environment Differences**

First, let's see exactly what's different between the two execution contexts:

```yaml
# In your GitHub Actions workflow, add this debug step:
- name: Debug Environment
  run: |
    echo "=== Environment Variables ==="
    env | sort
    echo "=== Process Limits ==="
    ulimit -a
    echo "=== User Info ==="
    id
    whoami
    echo "=== Groups ==="
    groups
    echo "=== SELinux/AppArmor Status ==="
    sestatus 2>/dev/null || echo "SELinux not found"
    aa-status 2>/dev/null || echo "AppArmor not found"
    echo "=== Systemd Context ==="
    systemctl show github-runner-hetzner-runner.service | grep -E "Private|Protect|Restrict|NoNew|Limit"
    echo "=== DBus Session ==="
    echo "DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-not set}"
    echo "=== Display ==="
    echo "DISPLAY=${DISPLAY:-not set}"
    echo "=== XDG Runtime ==="
    echo "XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-not set}"
```

### 2. **Add Verbose Playwright Logging**

Modify your test command to get more details:

```nix
# In flake.nix, update test-one:
export DEBUG="pw:browser*,pw:protocol"
export PWDEBUG=1  # This will slow down execution but show what's happening

node_modules/.bin/playwright test "$TEST_TARGET" \
  --workers=1 \
  --retries=0 \
  --timeout="$TIMEOUT_MS" \
  --trace=on \
  --screenshot=only-on-failure \
  --video=retain-on-failure
```

### 3. **Try Different Browser Launch Options**

Update your `playwright.config.ts` with more aggressive flags:

```typescript
projects: [
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      headless: true,  // Always true in CI
      launchOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',  // Important: bypasses the zygote process
          '--single-process',  // Run in single process mode
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled',
        ],
        // Try with a custom executable path if needed
        // executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      },
    },
  },
]
```

### 4. **Systemd Service Modifications**

The GitHub Actions runner service might have restrictions. Check and potentially override:

```bash
# Create a drop-in override for the service
sudo mkdir -p /etc/systemd/system/github-runner-hetzner-runner.service.d
sudo tee /etc/systemd/system/github-runner-hetzner-runner.service.d/override.conf << 'EOF'
[Service]
# Remove potential restrictions
PrivateTmp=no
ProtectSystem=no
ProtectHome=no
NoNewPrivileges=no
RestrictNamespaces=no
SystemCallFilter=

# Ensure proper environment
Environment="DISPLAY=:99"
Environment="XDG_RUNTIME_DIR=/run/user/$(id -u github-runner)"

# Increase limits
LimitNOFILE=65536
LimitNPROC=4096
EOF

sudo systemctl daemon-reload
sudo systemctl restart github-runner-hetzner-runner
```

### 5. **Alternative: Run Browser Server Separately**

Try running Playwright in remote mode:

```typescript
// In your test setup
import { chromium } from 'playwright';

let browser;
let wsEndpoint;

// Start browser server separately
beforeAll(async () => {
  browser = await chromium.launchServer({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    port: 0,  // Random port
  });
  wsEndpoint = browser.wsEndpoint();
});

// Connect to it in tests
test('basic page load', async () => {
  const browser = await chromium.connect(wsEndpoint);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveTitle(/Slipbox/);
  await context.close();
});
```

### 6. **Use Playwright's Docker Image**

As a workaround, run tests in a container:

```yaml
- name: Run tests in Docker
  run: |
    docker run --rm \
      -v $(pwd):/work \
      -w /work \
      mcr.microsoft.com/playwright:v1.54.1-jammy \
      bash -c "bun install && bun run test:ci"
```

### 7. **Check for PID Namespace Issues**

The error might be related to PID namespace isolation:

```bash
# Add to your debug step
echo "=== PID Namespace ==="
ls -la /proc/$$/ns/pid
readlink /proc/$$/ns/pid
```

## Most Likely Solutions

Based on the symptoms, try these in order:

1. **Add `--no-zygote` flag** - This bypasses the Chromium zygote process that's likely failing
2. **Check systemd restrictions** - Use the override.conf to remove restrictions
3. **Ensure XDG_RUNTIME_DIR exists**:
   ```bash
   mkdir -p /run/user/$(id -u github-runner)
   chown github-runner:github-runner /run/user/$(id -u github-runner)
   ```

4. **Use xvfb-run with proper display**:
   ```nix
   ${pkgs.xvfb-run}/bin/xvfb-run \
     --auto-servernum \
     --server-args="-screen 0 1920x1080x24" \
     node_modules/.bin/playwright test
   ```

The `--no-zygote` flag is particularly important because your core dump shows the crash is happening in the Zygote process, which is Chromium's process spawning mechanism that relies on namespaces and sandboxing features that might not be available in the restricted systemd context.

Let me know what the debug output shows, and we can narrow down the exact cause!
