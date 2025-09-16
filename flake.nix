{
  description = "Slipbox - Zettelkasten note-taking app";
  # Pure Nix deployment with Fixed-Output Derivation for dependencies

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Temporary non-FOD to calculate hash
        bunDepsTemp = pkgs.stdenv.mkDerivation {
          pname = "slipbox-deps-temp";
          version = "1.0.0";
          
          # Only files that determine dependencies
          src = pkgs.runCommand "dep-src" {} ''
            mkdir -p $out
            cp ${./package.json} $out/package.json
            cp ${./bun.lock} $out/bun.lock
          '';
          
          nativeBuildInputs = [ pkgs.bun pkgs.cacert ];
          
          buildPhase = ''
            cp $src/* .
            
            # Set up environment for bun
            export HOME=$TMPDIR
            
            # Install with frozen lockfile - deterministic!
            bun install --frozen-lockfile --no-progress --no-summary
            
            # Remove cache to reduce output size
            rm -rf $HOME/.bun
          '';
          
          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out/
            # Keep the lock file for reference
            cp bun.lock $out/
          '';
        };
        
        # Fixed-Output Derivation for dependencies
        # This ensures deterministic, reproducible builds
        bunDeps = pkgs.stdenv.mkDerivation {
          pname = "slipbox-deps";
          version = "1.0.0";
          
          # Only files that determine dependencies
          src = pkgs.runCommand "dep-src" {} ''
            mkdir -p $out
            cp ${./package.json} $out/package.json
            cp ${./bun.lock} $out/bun.lock
          '';
          
          nativeBuildInputs = [ pkgs.bun pkgs.cacert ];
          
          buildPhase = ''
            cp $src/* .
            
            # Set up environment for bun
            export HOME=$TMPDIR
            
            # Install with frozen lockfile - deterministic!
            bun install --frozen-lockfile --no-progress --no-summary
            
            # Remove cache to reduce output size
            rm -rf $HOME/.bun
          '';
          
          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out/
            # Keep the lock file for reference
            cp bun.lock $out/
          '';
          
          # Fixed-output derivation settings
          outputHashMode = "recursive";
          outputHashAlgo = "sha256";
          # This hash must be updated when dependencies change
          # To update: set to lib.fakeHash, build, copy hash from error
          outputHash = "sha256-Jitdwtz7Fox6rv1ogLdMzhH7Bb3FpG+mXQGlISAv2eA=";
        };
        
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
          # Expose deps package for manual building/testing
          deps = bunDeps;
          depsTemp = bunDepsTemp; # Temporary for calculating hash
          
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
        } // {
          # Production package - uses FOD for deterministic builds
          slipbox = pkgs.stdenv.mkDerivation {
            pname = "slipbox";
            version = "1.0.0";
            
            src = ./.;
            
            nativeBuildInputs = with pkgs; [
              bun
              nodejs_20
            ];
            
            buildPhase = ''
              # Copy source files
              cp -r $src/src .
              cp -r $src/scripts .
              cp -r $src/static . 2>/dev/null || true
              cp $src/package.json .
              cp $src/tsconfig.json .
              cp $src/tailwind.config.js . 2>/dev/null || true
              cp $src/postcss.config.js . 2>/dev/null || true
              cp $src/biome.json . 2>/dev/null || true
              
              # Link dependencies from FOD (deterministic!)
              ln -s ${bunDeps}/node_modules node_modules
              
              # Verify critical dependencies
              test -d node_modules/@starfederation/datastar || (echo "Datastar dependency missing!" && exit 1)
              test -d node_modules/tailwindcss || (echo "Tailwind dependency missing!" && exit 1)
              
              # Build client assets (Tailwind CSS)
              echo "Building client assets..."
              bun run build:client
            '';
            
            installPhase = ''
              mkdir -p $out/app $out/bin
              
              # Copy built application
              cp -r src $out/app/
              cp -r dist $out/app/
              cp -r static $out/app/ 2>/dev/null || true
              cp -r scripts $out/app/
              cp -r ${bunDeps}/node_modules $out/app/node_modules
              cp package.json $out/app/
              cp tsconfig.json $out/app/
              cp ${bunDeps}/bun.lock $out/app/
              
              # Create wrapper script
              cat > $out/bin/slipbox <<EOF
              #!/usr/bin/env bash
              cd $out/app
              export NODE_ENV=\''${NODE_ENV:-production}
              export SLIPBOX_DATA_DIR=\''${SLIPBOX_DATA_DIR:-/var/lib/slipbox}
              export PORT=\''${PORT:-3000}
              exec ${pkgs.bun}/bin/bun run src/index.ts "\$@"
              EOF
              chmod +x $out/bin/slipbox
            '';
            
            meta = with pkgs.lib; {
              description = "Slipbox production package";
              license = licenses.isc;
              platforms = platforms.all;
            };
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
