You're almost certainly hitting **systemd hardening + missing XDG runtime** differences between your interactive shell and the GitHub runner **service**. Manually `sudo -u github-runner` gives you a PAM/logind session (runtime dir, namespaces, looser sandbox), but the *service* likely runs with:

* no PAM session ⇒ **no `$XDG_RUNTIME_DIR`** (Chromium/Firefox use it for sockets)
* sandboxing like `RestrictNamespaces=`, `NoNewPrivileges=`, `PrivateUsers=`, tight `TasksMax`/`LimitNOFILE`
* possibly a low open-files limit or cgroup pid/mem limits

Fix it from two angles: **(A) patch the CI step env** and **(B) relax the runner’s systemd unit**.

---

### A) Make CI step environment sane (fastest)

Add this before running Playwright:

```yaml
- name: Prepare browser env
  run: |
    # Ensure a valid runtime dir (Chromium/Firefox need this)
    export XDG_RUNTIME_DIR="${RUNNER_TEMP}/xdg-runtime"
    mkdir -p "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR"

    # Avoid DBus/session weirdness
    unset DBUS_SESSION_BUS_ADDRESS

    # Raise limits to avoid silent crashes
    ulimit -n 1048576 || true
    ulimit -u 8192 || true

    # Extra logs for debugging crashes
    echo "DEBUG=pw:browser,pw:protocol,pw:api" >> "$GITHUB_ENV"
    echo "PLAYWRIGHT_BROWSERS_PATH=${{ env.PLAYWRIGHT_BROWSERS_PATH }}" >> "$GITHUB_ENV"
    echo "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" >> "$GITHUB_ENV"
    echo "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1" >> "$GITHUB_ENV"

- name: Run fast single test
  env:
    XDG_RUNTIME_DIR: ${{ env.XDG_RUNTIME_DIR }}
  run: |
    nix run .#test-one
```

Optional: get **Chrome logs** and **protocol traces**:

```ts
// playwright.config.ts
use: {
  ...devices['Desktop Chrome'],
  headless: true,
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--enable-logging=stderr',
      '--v=1',
      `--user-data-dir=${process.env.XDG_RUNTIME_DIR}/pw-user`,
    ],
  },
},
```

---

### B) Relax the systemd unit for the runner (NixOS)

Hardened defaults frequently kill zygote/user-ns. Loosen these (keep them as tight as your threat model allows):

```nix
{
  systemd.services.github-runner-hetzner-runner = {
    # ensure a proper session so /run/user/$UID exists
    serviceConfig = {
      User = "github-runner";
      PAMName = "login";
      # create the standard runtime dir (or rely on logind)
      Environment = [
        "XDG_RUNTIME_DIR=/run/user/%U"
        "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1"
        "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"
      ];

      # Relax sandboxing that breaks browsers
      NoNewPrivileges = false;
      RestrictNamespaces = false;
      PrivateUsers = false;
      PrivateTmp = false;
      PrivateDevices = false;
      ProtectHome = "read-only";  # or "no" if needed
      SystemCallFilter = "";      # remove filters for now, tighten later
      CapabilityBoundingSet = ""; # don't drop caps prematurely

      # Avoid process/file limits killing the browser
      TasksMax = "infinity";
      LimitNOFILE = 1048576;
      LimitNPROC = 16384;
      OOMPolicy = "continue";
    };

    wants = [ "systemd-logind.service" ];
    after  = [ "systemd-logind.service" ];
  };

  # keep a user session around (so /run/user/$uid exists for services)
  services.logind.lingerUsers = [ "github-runner" ];
}
```

> If you don’t want to relax globally, at minimum set `PAMName=login` **and** provide a valid `XDG_RUNTIME_DIR` for the service, plus raise `LimitNOFILE`/`TasksMax`.

---

### Quick diagnostics to confirm the cause

Drop this step in CI to compare with your manual run:

```yaml
- name: Dump env and limits
  run: |
    set -x
    id
    env | sort
    echo "----- limits -----"
    ulimit -a
    echo "----- runtime dir -----"
    echo "XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-<unset>}"
    ls -ld "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}" || true
    echo "----- systemd show -----"
    systemctl show github-runner-hetzner-runner.service | \
      grep -E 'User=|PAMName=|RestrictNamespaces|NoNewPrivileges|PrivateUsers|PrivateTmp|TasksMax|LimitNOFILE|LimitNPROC' || true
```

If `XDG_RUNTIME_DIR` is missing or points to a non-existent dir, that’s your smoking gun. If `RestrictNamespaces=yes` or `NoNewPrivileges=yes` show up, that’s the other.

---

### Extra knobs (use sparingly)

* Chromium: add `--disable-setuid-sandbox` too (on some kernels it helps even with `--no-sandbox`).
* Firefox: set `MOZ_HEADLESS=1` and `TMPDIR=$RUNNER_TEMP`.
* If `/dev/shm` is tiny, you already use `--disable-dev-shm-usage`, but you can also:
  `export TMPDIR="$RUNNER_TEMP"; mkdir -p "$TMPDIR"` to keep large temp files off small tmpfs.

---

### Why it works manually but not as a service

Your manual `sudo -u github-runner` run gets:

* a **PAM/logind session** → `/run/user/$uid` exists → `$XDG_RUNTIME_DIR` auto-set by pam\_systemd
* no service sandbox flags blocking namespaces/syscalls
* higher resource limits via your shell

The service didn’t.

---

### TL;DR

1. Ensure `$XDG_RUNTIME_DIR` exists & is 0700 in the CI step, and unset DBus.
2. Raise `LimitNOFILE`/`TasksMax`.
3. In the runner unit, enable `PAMName=login` and relax `RestrictNamespaces/NoNewPrivileges/PrivateUsers` (or run runner as a **user** service with lingering).

Those three fix 95% of “browser launches locally but dies instantly in systemd CI” cases.

