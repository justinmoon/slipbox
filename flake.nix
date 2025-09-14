{
  description = "Slipbox - Zettelkasten note-taking app";
  # CI fix attempt with playwright-driver.browsers

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Define the development shell environment
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Core dependencies
            bun
            nodejs_20
            
            # Build tools
            nodePackages.typescript
            nodePackages.typescript-language-server
            biome
            
            # Testing - use playwright-driver browsers
            playwright-driver.browsers
            
            # Utilities
            git
            rsync
            jq
          ];
          
          shellHook = ''
            echo "Slipbox development environment"
            echo "Available commands:"
            echo "  bun install - Install dependencies"
            echo "  bun run dev - Start development server"
            echo "  bun run check - Run linting and formatting checks"
            echo "  bun run test - Run tests"
            echo ""
            echo "Using Nix-provided tools:"
            echo "  Bun: $(bun --version)"
            echo "  Node: $(node --version)"
            echo "  TypeScript: $(tsc --version)"
            echo "  Biome: $(biome --version)"
            echo "  Playwright browsers: ${pkgs.playwright-driver.browsers}"
          '';
          
          # Tell Playwright to use Nix-provided browsers
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        };
        
      in
      {
        devShells.default = devShell;
        
        # Package definition for the app
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "slipbox";
          version = "1.0.0";
          
          src = ./.;
          
          nativeBuildInputs = with pkgs; [
            bun
            nodejs_20
            nodePackages.typescript
            biome
          ];
          
          buildPhase = ''
            # Copy source to build directory
            cp -r . $TMPDIR/build
            cd $TMPDIR/build
            
            # Install dependencies
            bun install --frozen-lockfile
            
            # Run checks
            biome check .
            tsc --noEmit
            
            # Build the application
            bun run build:client
            EMBED_ASSETS=true bun build src/index.ts --outdir $out/dist --target bun
          '';
          
          installPhase = ''
            mkdir -p $out/bin
            
            # Create wrapper script
            cat > $out/bin/slipbox <<EOF
            #!/usr/bin/env bash
            exec ${pkgs.bun}/bin/bun $out/dist/index.js "\$@"
            EOF
            chmod +x $out/bin/slipbox
            
            # Copy necessary files
            cp -r src $out/
            cp package.json $out/
            cp bun.lockb $out/ 2>/dev/null || true
          '';
          
          meta = with pkgs.lib; {
            description = "Zettelkasten-style note-taking app";
            license = licenses.isc;
            platforms = platforms.all;
          };
        };
        
        # App definition for nix run
        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
        };
        
        # CI runner app - runs the same pipeline as GitHub Actions
        apps.ci = {
          type = "app";
          program = "${pkgs.writeShellScriptBin "ci-runner" ''
            set -e
            
            # Colors for output
            RED='\033[0;31m'
            GREEN='\033[0;32m'
            YELLOW='\033[1;33m'
            BLUE='\033[0;34m'
            NC='\033[0m' # No Color
            
            echo -e "''${BLUE}════════════════════════════════════════''${NC}"
            echo -e "''${BLUE}     Running CI Pipeline ''${NC}"
            echo -e "''${BLUE}════════════════════════════════════════''${NC}"
            echo ""
            
            # Function to run a step
            run_step() {
              local step_num=$1
              local step_total=$2
              local step_name=$3
              shift 3
              
              echo -e "''${YELLOW}[''${step_num}/''${step_total}] ''${step_name}...''${NC}"
              
              if "$@"; then
                echo -e "''${GREEN}✓ ''${step_name} passed''${NC}"
                echo ""
                return 0
              else
                echo -e "''${RED}✗ ''${step_name} failed''${NC}"
                echo ""
                return 1
              fi
            }
            
            # Setup environment
            export PATH="${pkgs.bun}/bin:${pkgs.nodejs_20}/bin:${pkgs.biome}/bin:${pkgs.nodePackages.typescript}/bin:${pkgs.git}/bin:$PATH"
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            export CI=true
            
            # Run CI steps
            run_step 1 5 "Installing dependencies" \
              ${pkgs.bun}/bin/bun install || exit 1
            
            run_step 2 5 "Running biome checks" \
              ${pkgs.biome}/bin/biome check . || exit 1
            
            run_step 3 5 "TypeScript type checking" \
              ${pkgs.nodePackages.typescript}/bin/tsc --noEmit || exit 1
            
            run_step 4 5 "Building application" \
              bash -c "mkdir -p ~/.slipbox-dev && ${pkgs.bun}/bin/bun run build" || exit 1
            
            run_step 5 5 "Running tests" \
              ${pkgs.bun}/bin/bun run test:ci || exit 1
            
            echo -e "''${GREEN}════════════════════════════════════════''${NC}"
            echo -e "''${GREEN}  ✓ All CI checks passed! ''${NC}"
            echo -e "''${GREEN}════════════════════════════════════════''${NC}"
          ''}/bin/ci-runner";
        };

        # Fast single-test runner for tight iteration
        apps.test-one = {
          type = "app";
          program = "${pkgs.writeShellScriptBin "ci-test-one" ''
            set -euo pipefail

            # Defaults: one test file and short timeout; override with TEST and GLOB
            TEST_TARGET="''${TEST:-tests/basic.spec.ts}"
            : "''${TIMEOUT_MS:=15000}"

            # Tooling env
            export PATH="${pkgs.bun}/bin:${pkgs.nodejs_20}/bin:${pkgs.biome}/bin:${pkgs.nodePackages.typescript}/bin:${pkgs.git}/bin:$PATH"
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            unset DBUS_SESSION_BUS_ADDRESS || true
            
            echo "Using Playwright browsers from: ''${PLAYWRIGHT_BROWSERS_PATH}"
            echo "Running single test target: ''${TEST_TARGET} (timeout ''${TIMEOUT_MS}ms)"
            echo "Using Chromium with --no-sandbox flags for CI compatibility"

            ${pkgs.bun}/bin/bun install
            # Minimal build required for server startup
            ${pkgs.bun}/bin/bun run build:client

            # Run Playwright test with --no-sandbox flags set in config
            node_modules/.bin/playwright test "$TEST_TARGET" \
              --workers=1 \
              --retries=0 \
              --timeout="$TIMEOUT_MS"
          ''}/bin/ci-test-one";
        };
      });
}
