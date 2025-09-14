{
  description = "Slipbox - Zettelkasten note-taking app";

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
            
            # Testing
            playwright-driver
            
            # Utilities
            git
            rsync
            jq
          ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
            # Linux-only packages
            chromium
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
          
          # Set up environment variables
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
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
      });
}