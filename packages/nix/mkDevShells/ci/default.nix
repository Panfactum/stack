{ pkgs, util, }:
({ config, ... }:
  let
    ci = config.env.CI == "true";
    mkIf = pkgs.lib.mkIf;
  in {
    packages = with pkgs;
      mkIf ci [
        (util.customShellScript "delete-tf-locks") # cleanup tf locks on failure
      ];
  })
