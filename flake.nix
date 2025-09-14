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
        packages = {
          default = pkgs.stdenv.mkDerivation {
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
        } // (pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
          # Production binary package - builds binary inside derivation (Linux only)
          slipbox-binary = pkgs.stdenv.mkDerivation {
            pname = "slipbox-binary";
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
              
              # Build client assets
              bun run build:client
              
              # Build the standalone binary with embedded assets
              NODE_ENV=production EMBED_ASSETS=true bun build src/index.ts \
                --compile --target=bun-linux-x64 --outfile slipbox-binary
            '';
            
            installPhase = ''
              mkdir -p $out/bin
              cp slipbox-binary $out/bin/slipbox
              chmod +x $out/bin/slipbox
            '';
            
            meta = with pkgs.lib; {
              description = "Slipbox production binary with embedded assets";
              license = licenses.isc;
              platforms = [ "x86_64-linux" ];
            };
          };
        });
        
        # App definition for nix run
        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
        };
        
        # CI runner app - runs the same pipeline as GitHub Actions
        apps.ci = {
          type = "app";
          program = "${pkgs.writeShellScriptBin "ci-runner" ''
            # Setup environment
            export PATH="${pkgs.bun}/bin:${pkgs.nodejs_20}/bin:${pkgs.biome}/bin:${pkgs.nodePackages.typescript}/bin:${pkgs.git}/bin:$PATH"
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            export CI=true
            
            # Run the CI script
            exec ${./scripts/nix-ci.sh}
          ''}/bin/ci-runner";
        };

        # Debug Playwright tests - useful for troubleshooting CI failures
        apps.debug-playwright = {
          type = "app";
          program = "${pkgs.writeShellScriptBin "debug-playwright" ''
            # Setup environment
            export PATH="${pkgs.bun}/bin:${pkgs.nodejs_20}/bin:${pkgs.biome}/bin:${pkgs.nodePackages.typescript}/bin:${pkgs.git}/bin:$PATH"
            export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            export CI=true
            
            echo "Using Playwright browsers from: $PLAYWRIGHT_BROWSERS_PATH"
            
            # Run the debug script
            exec ${./scripts/nix-debug-playwright.sh}
          ''}/bin/debug-playwright";
        };
      });
}
