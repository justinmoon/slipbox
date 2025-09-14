Below, I'll address your issue step by step based on the details you've provided. I've been through similar Playwright CI headaches on self-hosted runners (especially with NixOS, which adds its own layers of sandboxing and immutability). The core symptom—browser launching but immediately closing, leading to "Target page, context or browser has been closed"—often points to environmental differences, resource constraints, or permission/namespace issues that aren't present in manual runs. I'll explain why this might be happening, suggest debugging techniques, and propose workarounds.

I'll incorporate relevant insights from a recent web search (conducted on 2025-09-14). For example, a similar issue was discussed on [stackoverflow.com](https://stackoverflow.com/questions/78915766/playwright-e2e-tests-passing-locally-but-failing-in-github-actions-with-next-js), where Playwright tests passed locally but failed in GitHub Actions due to subtle environment differences (e.g., auth flows and page navigation timing out or closing prematurely). Debugging tips for Chromium on Linux from [chromium.googlesource.com](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/debugging.md) could also help trace browser crashes.

### 1. Why the Same Command Works Manually but Not in CI
The mystery boils down to **execution context differences**. When you run `nix run .#test-one` manually (even as the `github-runner` user via `sudo -u`), you're in an interactive shell session with a full user environment (e.g., inherited env vars, session bus, and no service-level restrictions). In contrast, GitHub Actions executes commands via its runner service (`github-runner-hetzner-runner.service`), which is a systemd-managed process. This introduces isolation that can subtly break browser launches. Here's what's likely different:

- **Systemd Service Restrictions (Your Question 2)**: Systemd units often apply security hardening that isn't present in manual shells. Check your service file (`/etc/systemd/system/github-runner-hetzner-runner.service` or similar) for directives like:
  - `ProtectSystem=strict` or `ProtectHome=yes`: These restrict filesystem access, which could prevent the browser from writing to `/tmp` or `/dev/shm` (shared memory). Playwright/Chromium needs these for sandboxing and page creation.
  - `NoNewPrivileges=yes`: This blocks privilege escalation, which might interfere with Chromium's sandbox (even with `--no-sandbox`). Your earlier core dump ("user namespaces / setuid sandbox not available") screams this—Chromium's zygote process relies on namespaces for isolation, but systemd might be blocking them.
  - `PrivateTmp=yes` or `PrivateDevices=yes`: These create isolated `/tmp` and device nodes, which can cause browsers to fail if they expect shared resources.
  - **Action**: Run `systemctl show github-runner-hetzner-runner.service` and look for these. If present, temporarily override them in a custom unit file (e.g., via `systemctl edit`) for testing: add `[Service]` overrides like `NoNewPrivileges=no` or `ProtectSystem=off`. Reload with `systemctl daemon-reload` and restart the service.

- **Cgroup/Namespace Isolation (Your Question 3)**: Yes, this is a strong suspect. GitHub Actions runners (especially self-hosted) often run in cgroup v2 namespaces for resource limiting (e.g., via systemd's `Slice=` or `MemoryMax=`). NixOS exacerbates this with its own build sandboxing in flakes. Chromium/Playwright expects unconfined access to user namespaces for its multi-process model (zygote forking). If the runner service is in a restricted cgroup, it could kill the browser process immediately after launch.
  - **Evidence**: Your core dump mentions "user namespaces / setuid sandbox not available," which aligns with cgroup restrictions disabling namespaces.
  - **Action**: Check `systemctl status github-runner-hetzner-runner.service` for cgroup details (look under "Control group"). If it's sliced (e.g., under `system.slice`), try moving it to a less restricted slice or disabling namespace restrictions with `systemd-run --user --scope` wrappers in your workflow (more on this below).

- **Environment Variables and Session Differences (Your Question 4)**: GitHub Actions sets a bunch of env vars (e.g., `GITHUB_*`, `CI=true`, `RUNNER_*`) that aren't present in manual runs. More critically:
  - `DBUS_SESSION_BUS_ADDRESS` might be unset or different in the service (you mentioned unsetting it—good, but confirm). Browsers sometimes rely on D-Bus for communication.
  - `DISPLAY` or X11 vars: Even with `xvfb-run`, if the service lacks a graphical session, it could fail.
  - PATH or LD_LIBRARY_PATH might differ, causing browser binaries to load wrong libs (Nix provides browsers via `PLAYWRIGHT_BROWSERS_PATH`, but CI might not resolve it the same way).
  - Nix-specific: Flakes run in a pure environment, but CI might inherit impurities from the runner.
  - **Action**: Add a debugging step to your workflow to dump the env:
    ```yaml
    - name: Dump environment
      run: env > env-dump.txt && cat env-dump.txt
    ```
    Compare this to a manual run's `env` output. Also, explicitly set vars in the workflow:
    ```yaml
    - name: Run fast single test
      env:
        PLAYWRIGHT_BROWSERS_PATH: "${{ github.workspace }}/node_modules/ms-playwright"  # Or wherever Nix puts it
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: "true"
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
        DBUS_SESSION_BUS_ADDRESS: ""  # Explicitly unset
      run: nix run .#test-one
    ```

- **Working Directory and Permissions**: The service's `WorkingDirectory=/run/github-runner/hetzner-runner` might have different perms or mounts than your manual `cd` path. Nix builds are immutable, but if the runner chroots or remounts, it could break.

- **Other Subtleties**: Timing/race conditions. In CI, the browser might launch faster/slower due to load, causing premature closure (seen in the [stackoverflow.com](https://stackoverflow.com/questions/78915766/playwright-e2e-tests-passing-locally-but-failing-in-github-actions-with-next-js) thread with Next.js auth flows).

### 2. Debugging Techniques
To pinpoint what's happening during browser launch:

- **Enable Playwright Tracing**: Add `--trace=on` to your test command in `flake.nix` (or workflow). This generates JSON traces you can view with `playwright show-trace`. Set `trace: 'on-first-retry'` in `playwright.config.ts` to avoid bloat.
  ```nix
  node_modules/.bin/playwright test "$TEST_TARGET" --trace=on ...
  ```

- **Verbose Logging**: Set `DEBUG=pw:*` env var in your workflow to log Playwright internals.
  ```yaml
  - name: Run fast single test
    env:
      DEBUG: "pw:*"
    run: nix run .#test-one
  ```

- **Strace the Browser Process**: Wrap the test in `strace` to trace syscalls. Modify your `flake.nix` test command:
  ```nix
  strace -f -o /tmp/strace.log -e trace=clone,execve,open node_modules/.bin/playwright test ...
  ```
  Run this in CI and artifact the `/tmp/strace.log` for review. Look for failures around namespace creation (`clone` with `CLONE_NEWUSER`) or file access.

- **Core Dump Analysis**: Since you have a stack trace, enable full core dumps in CI. Set `ulimit -c unlimited` in your workflow and check `/proc/sys/kernel/core_pattern`. Use tools like `coredumpctl` on NixOS to inspect.

- **Chromium-Specific Debugging**: Per [chromium.googlesource.com](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/debugging.md), run the browser manually in CI with `--enable-logging --v=1` (add to `launchOptions.args`). For tests, use `--gtest_filter` if adapting browser tests. Attach gdb: `gdb --args out/Debug/browser_tests --single-process`.

- **Compare Manual vs. CI Launches**: In CI, add a step to manually launch Chromium/Firefox outside Playwright (e.g., `chromium-browser --no-sandbox --headless --disable-gpu --version`) and log output.

### 3. Potential Workarounds and Fixes
- **More Permissive Browser Flags (Your Question 5)**: Yes, try these in `playwright.config.ts`:
  ```typescript
  launchOptions: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",  // Explicitly disable setuid
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-namespace-sandbox",  // If available
      "--user-namespace-sandbox=false"  // Chromium-specific
    ],
  },
  ```
  Also, try `--single-process`
