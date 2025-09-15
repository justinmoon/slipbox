# Dedicated CI user for GitHub Actions
{ config, lib, pkgs, ... }:
{
  # Dedicated CI user for GitHub Actions
  users.users.ci = {
    isSystemUser = true;
    group = "ci";
    home = "/var/lib/ci";
    createHome = true;
    description = "CI/CD deployment user";
    
    # SSH key for GitHub Actions (if using ssh deployment)
    # TODO: Add actual SSH key from GitHub Actions
    openssh.authorizedKeys.keys = [
      # "ssh-ed25519 AAAAC3... github-actions@slipbox"
    ];
  };
  
  users.groups.ci = {};
  
  # CI user can manage deployment profiles
  nix.settings.trusted-users = [ "ci" ];
}