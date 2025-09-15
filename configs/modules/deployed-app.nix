# Module for deploying applications from CI profiles
{ config, lib, pkgs, ... }:
let
  cfg = config.services.deployed-app;
in
{
  options.services.deployed-app = {
    instances = lib.mkOption {
      type = lib.types.attrsOf (lib.types.submodule {
        options = {
          port = lib.mkOption {
            type = lib.types.int;
            description = "Port for the service";
          };
          
          dataDir = lib.mkOption {
            type = lib.types.str;
            default = name: "/var/lib/${name}";
            description = "Data directory for the service";
          };
          
          extraEnv = lib.mkOption {
            type = lib.types.attrsOf lib.types.str;
            default = {};
            description = "Extra environment variables";
          };
        };
      });
      default = {};
      description = "Application instances to deploy";
    };
  };
  
  config = {
    # Create a systemd service for each instance
    systemd.services = lib.mapAttrs' (name: cfg:
      lib.nameValuePair name {
        description = "${name} application service";
        wantedBy = [ "multi-user.target" ];
        after = [ "network.target" ];
        
        # Wait for profile to exist before starting
        unitConfig = {
          ConditionPathExists = "/nix/var/nix/profiles/per-user/ci/${name}/bin/${name}-server";
        };
        
        serviceConfig = {
          Type = "simple";
          Restart = "always";
          RestartSec = "10s";
          
          # Run from CI user's profile
          ExecStart = "/nix/var/nix/profiles/per-user/ci/${name}/bin/${name}-server";
          
          # Security - use dynamic user for runtime
          DynamicUser = true;
          StateDirectory = name;
          
          # Environment
          Environment = [
            "NODE_ENV=production"
            "PORT=${toString cfg.port}"
            "DATA_DIR=/var/lib/${name}"
          ] ++ (lib.mapAttrsToList (k: v: "${k}=${v}") cfg.extraEnv);
          
          # Hardening
          NoNewPrivileges = true;
          PrivateTmp = true;
          ProtectSystem = "strict";
          ProtectHome = true;
          ReadWritePaths = [ "/var/lib/${name}" ];
          
          # Resources
          MemoryMax = "512M";
          CPUQuota = "100%";
        };
      }
    ) cfg.instances;
    
    # Create data directories
    systemd.tmpfiles.rules = lib.mapAttrsToList (name: cfg:
      "d /var/lib/${name} 0750 ${name} ${name} -"
    ) cfg.instances;
  };
}