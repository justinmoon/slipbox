{
  description = "Slipbox - Zettelkasten note-taking app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    playwright.url = "github:pietdevries94/playwright-web-flake/1.54.1";
  };

  outputs = { self, nixpkgs, flake-utils, playwright }:
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
            
            # Testing - use playwright from the flake
            playwright.packages.${system}.playwright-test
            
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
          '';
          
          # Prevent npm/bun from downloading browsers (we use Nix-provided ones)
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
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
            
            # Debug information
            echo "=== DEBUG: Environment Info ==="
            echo "Working directory: $(pwd)"
            echo "Working dir length: $(pwd | wc -c) characters"
            echo "User: $(whoami)"
            echo "Home: $HOME"
            echo ""
            echo "=== DEBUG: Path Info ==="
            echo "PATH length: ''${#PATH} characters"
            echo "PATH: $PATH" | head -c 200
            echo "..."
            echo ""
            echo "=== DEBUG: Playwright Environment ==="
            echo "PLAYWRIGHT_BROWSERS_PATH: $PLAYWRIGHT_BROWSERS_PATH"
            echo "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: $PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"
            echo "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: $PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS"
            echo "CI: $CI"
            echo "DISPLAY: $DISPLAY"
            echo ""
            echo "=== DEBUG: Browser Availability ==="
            if [ -d "$PLAYWRIGHT_BROWSERS_PATH" ]; then
              echo "Browser directory exists"
              ls -la "$PLAYWRIGHT_BROWSERS_PATH" | head -10
            else
              echo "WARNING: Browser directory does not exist!"
            fi
            echo ""
            echo "=== DEBUG: Process Limits ==="
            ulimit -a | head -10
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
            
            # Enter nix develop shell and run all commands
            # Put playwright-test first in PATH so it takes precedence over node_modules version
            export PATH="${playwright.packages.${system}.playwright-test}/bin:${pkgs.bun}/bin:${pkgs.nodejs_20}/bin:${pkgs.biome}/bin:${pkgs.nodePackages.typescript}/bin:${pkgs.git}/bin:$PATH"
            # Playwright-web-flake automatically sets PLAYWRIGHT_BROWSERS_PATH via wrapper
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export CI=true
            
            # Use the current directory (where nix run was executed)
            
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
              ${playwright.packages.${system}.playwright-test}/bin/playwright test --reporter=list || {
                echo ""
                echo -e "''${RED}=== DEBUG: Test Failure Analysis ===''${NC}"
                echo "Tests failed. Checking for common issues..."
                echo ""
                echo "1. Checking for Chrome processes:"
                ps aux | grep -i chrome | head -5 || echo "No chrome processes found"
                echo ""
                echo "2. Checking tmp directory:"
                ls -la /tmp | grep -i playwright | head -5 || echo "No playwright files in /tmp"
                echo ""
                echo "3. System error messages:"
                dmesg | tail -20 2>/dev/null || echo "Cannot read dmesg"
                echo ""
                echo "4. Directory permissions:"
                ls -ld . ~/.slipbox-dev /tmp 2>/dev/null
                echo ""
                echo "5. Socket path length check:"
                echo "Current path + socket would be: $(pwd | wc -c) + ~50 = ~$(($(pwd | wc -c) + 50)) chars"
                echo "(Linux socket path limit is 108 chars)"
                exit 1
              }
            
            echo -e "''${GREEN}════════════════════════════════════════''${NC}"
            echo -e "''${GREEN}  ✓ All CI checks passed! ''${NC}"
            echo -e "''${GREEN}════════════════════════════════════════''${NC}"
          ''}/bin/ci-runner";
        };
      });
}