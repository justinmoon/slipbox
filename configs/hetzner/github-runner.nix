# GitHub Runner configuration for CI/CD
{ config, pkgs, lib, ... }:
{
  services.github-runners = {
    hetzner-runner = {
      enable = true;
      name = "hetzner-runner";
      url = "https://github.com/justinmoon/slipbox";
      tokenFile = "/var/lib/github-runner-token";
      
      # Run as CI user
      user = "ci";
      group = "ci";
      
      extraLabels = [ "nixos" "hetzner" "self-hosted" ];
      
      # Packages available to runner
      extraPackages = with pkgs; [
        git
        gh
        curl
        nix
        systemd
      ];
      
      serviceOverrides = {
        # Grant necessary permissions for CI operations
        PrivateDevices = lib.mkForce false;
        PrivateTmp = lib.mkForce false;
        ProtectHome = lib.mkForce false;
        RestrictNamespaces = lib.mkForce false;
        
        # Environment
        Environment = [
          "NIX_PATH=nixpkgs=/nix/var/nix/profiles/per-user/ci/channels/nixos"
        ];
      };
    };
  };
}