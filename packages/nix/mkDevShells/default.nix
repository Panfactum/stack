{ panfactumPkgs, devenv, forEachSystem, inputs, }:
{ modules, pkgs }:
(forEachSystem (system:
  let
    # Panfactum packages
    panfactumResolvedPkgs = panfactumPkgs.legacyPackages.${system};

    # User packages
    userResolvedPkgs = pkgs.legacyPackages.${system};

    # Utitily functions
    util = dir: {
      customNixModule = module:
        import ./${dir}/${module}.nix { pkgs = panfactumResolvedPkgs; };
      customShellScript = name:
        (panfactumResolvedPkgs.writeScriptBin name
          (builtins.readFile ./${dir}/${name}.sh)).overrideAttrs (old: {
            buildCommand = ''
              ${old.buildCommand}
               patchShebangs $out'';
          });
    };

    # Devenv
    common = import ./common {
      pkgs = panfactumResolvedPkgs;
      util = util "./common";
    };
    local = import ./local {
      pkgs = panfactumResolvedPkgs;
      util = util "./local";
    };
    ci = import ./ci {
      pkgs = panfactumResolvedPkgs;
      util = util "./ci";
    };
  in {
    default = devenv.lib.mkShell {
      inherit inputs;
      pkgs = userResolvedPkgs;
      modules = [ common local ci ] ++ modules;
    };
  }))
