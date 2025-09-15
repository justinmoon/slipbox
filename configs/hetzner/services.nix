# Service configuration for deployed applications
{
  imports = [ ../modules/deployed-app.nix ];
  
  services.deployed-app.instances = {
    slipbox = {
      port = 3000;
      extraEnv = {
        SLIPBOX_DATA_DIR = "/var/lib/slipbox";
      };
    };
    
    haven = {
      port = 3001;
    };
    
    # Easy to add more services
  };
}