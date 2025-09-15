# Allow CI user to restart services without sudo
{ config, lib, pkgs, ... }:
{
  # Allow CI user to restart services without sudo
  security.polkit.extraConfig = ''
    polkit.addRule(function(action, subject) {
      if (action.id == "org.freedesktop.systemd1.manage-units" &&
          subject.user == "ci") {
        var unit = action.lookup("unit");
        
        // Allow managing app services only
        if (unit.match(/^(slipbox|haven|app-[a-z0-9-]+)\.service$/)) {
          return polkit.Result.YES;
        }
      }
      return polkit.Result.NO;
    });
  '';
}