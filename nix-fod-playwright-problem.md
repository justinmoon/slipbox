# Help Needed: Nix FOD Fails with Playwright Dependency

## Problem Summary
I'm trying to create a Fixed-Output Derivation (FOD) for a Bun/TypeScript project's dependencies. The FOD works perfectly UNTIL I add `@playwright/test` as a dev dependency - then it fails with:
```
error: fixed-output derivations must not reference store paths: 
'/nix/store/...-slipbox-deps-1.0.0.drv' references 1 distinct paths, 
e.g. '/nix/store/...-bash-5.3p3'
```

## Key Discovery
Through binary search, I've confirmed that `@playwright/test` is the ONLY dependency causing this issue. All other dependencies (tailwindcss, biome, typescript, etc.) work fine in the FOD.

## Our Nix Setup

### Current FOD Configuration (flake.nix)
```nix
bunDeps = pkgs.stdenvNoCC.mkDerivation {
  pname = "slipbox-deps";
  version = "1.0.0";
  
  src = pkgs.runCommand "dep-src" {} ''
    mkdir -p $out
    cp ${./package.json} $out/package.json
    cp ${./bun.lock} $out/bun.lock
  '';
  
  nativeBuildInputs = [ pkgs.bun pkgs.cacert ];
  
  buildPhase = ''
    cp $src/* .
    export HOME=$TMPDIR
    bun install --frozen-lockfile --no-progress --no-summary --ignore-scripts
    rm -rf $HOME/.bun
  '';
  
  installPhase = ''
    mkdir -p $out
    cp -r node_modules $out/
    cp bun.lock $out/
  '';
  
  outputHashMode = "recursive";
  outputHashAlgo = "sha256";
  outputHash = pkgs.lib.fakeHash;  # This is where we fail
};
```

## What I've Discovered

### The Issue is Related to Shebangs
Playwright installs executable files with shebangs:
- `node_modules/playwright/cli.js` starts with `#!/usr/bin/env node`
- `node_modules/@playwright/test/cli.js` has the same
- `node_modules/.bin/playwright` is a symlink with shebang

### Failed Attempts to Fix

1. **Tried removing .bin directory**:
```nix
buildPhase = ''
  # ... bun install ...
  rm -rf node_modules/.bin
'';
```
Result: The `rm` command itself introduces a bash reference!

2. **Tried patching shebangs out**:
```nix
buildPhase = ''
  # ... bun install ...
  find node_modules -name "cli.js" -type f -exec chmod -x {} \;
  for file in $(find node_modules -name "cli.js" -type f); do
    if head -n1 "$file" | grep -q "^#!/"; then
      tail -n +2 "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
  done
'';
```
Result: The shell commands (find, grep, etc.) create bash references!

3. **Tried `dontPatchShebangs = true`** - No effect (FOD doesn't run fixup phase anyway)

4. **Tried `--ignore-scripts` flag** - Doesn't help (shebangs are in the package files themselves)

5. **Tried stdenvNoCC instead of stdenv** - Same error

## The Paradox

- WITH Playwright → FOD fails due to shebangs referencing store paths
- WITH cleanup commands to remove shebangs → FOD fails due to bash references from cleanup commands
- WITHOUT Playwright → FOD works but we lose testing capability

The issue only occurs when using `lib.fakeHash`. When I build without FOD and get a real hash, then use that hash, it STILL fails with the same error (even though some people report real hashes work).

## Environment Details
- Nix: Using flakes on NixOS unstable
- Package manager: Bun v1.2.21
- Project: TypeScript web app with Datastar framework
- Test framework: Playwright (needed for E2E tests)

## Specific Questions

1. Is there a way to exclude files from a FOD's store path reference check?
2. Can we somehow build node_modules in a FOD without the .bin directory being created at all?
3. Is there a different approach to handling test dependencies that shouldn't be in the FOD?
4. Why does the error persist even with a real hash (not lib.fakeHash)?
5. Could we use overlays or overrides to provide a "fixed" version of the playwright package?

## What Works (For Reference)
I have another project (`test-app`) with the EXACT same FOD pattern that works perfectly, but it doesn't have Playwright as a dependency. The moment I add Playwright to test-app, it fails the same way.

## Ideal Solution
I need a way to either:
- Make FOD work WITH Playwright installed, OR
- Have a clean pattern for installing Playwright only when needed for tests (not in FOD)

The app deploys to production without tests, so Playwright isn't needed in the final build. But for development and CI, we need to run Playwright tests.

Any insights would be greatly appreciated! I feel like I'm missing something fundamental about how FODs handle executables or how to properly clean node_modules without introducing store references.