{ nixpkgs, devenv, systems, inputs, }:
let forEachSystem = nixpkgs.lib.genAttrs (import systems);
in modules:
(forEachSystem (system:
  let
    # Nix packages
    pkgs = nixpkgs.legacyPackages.${system};

    # Utitily functions
    util = dir: {
      customNixModule = module: import ./${dir}/${module}.nix { inherit pkgs; };
      customShellScript = name:
        (pkgs.writeShellScriptBin name (builtins.readFile ./${dir}/${name}.sh));
    };

    # Devenv
    common = import ./common {
      inherit pkgs;
      util = util "./common";
    };
    local = import ./local {
      inherit pkgs;
      util = util "./local";
    };
    ci = import ./ci {
      inherit pkgs;
      util = util "./ci";
    };
  in {
    default = devenv.lib.mkShell {
      inherit inputs pkgs;
      modules = [ common local ci ] ++ modules;
    };
  }))
