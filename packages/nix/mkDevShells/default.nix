{ panfactumPkgs, devenv, forEachSystem, inputs }:
{ modules, pkgs }:
(forEachSystem (system:
  let
    # Panfactum packages
    panfactumResolvedPkgs = panfactumPkgs.legacyPackages.${system};

    # User packages
    userResolvedPkgs = pkgs.legacyPackages.${system};

    # Utitily functions
    utilBuilder = dir: {
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
    util = utilBuilder ".";

    # Pinned Package Sources
    src1 = import (panfactumResolvedPkgs.fetchFromGitHub {
      owner = "NixOS";
      repo = "nixpkgs";
      rev = "a343533bccc62400e8a9560423486a3b6c11a23b";
      sha256 = "TofHtnlrOBCxtSZ9nnlsTybDnQXUmQrlIleXF1RQAwQ=";
    }) { inherit system; };

    src2 = import (panfactumResolvedPkgs.fetchFromGitHub {
      owner = "NixOS";
      repo = "nixpkgs";
      rev = "325eb628b89b9a8183256f62d017bfb499b19bd9";
      sha256 = "9mZL4N+G/iAADDdR6vKDFwiweYLO8hAmjnDHvfVhYCY=";
    }) { inherit system; };

    pgadmin = src1.pgadmin4-desktopmode.overrideAttrs
      (finalAttrs: previousAttrs: {
        postPatch = previousAttrs.postPatch + ''
          substituteInPlace web/config.py --replace "MASTER_PASSWORD_REQUIRED = True" "MASTER_PASSWORD_REQUIRED = False"
        '';

        # These install checks take way too long on first install
        # and are very brittle (don't work on aaarch64)
        doCheck = false;
        doInstallCheck = false;
      });

    # Devenv
    base = { config, ... }:
      let
        local = config.env.CI != "true";
        mkIf = panfactumResolvedPkgs.lib.mkIf;
      in {
        env = with panfactumResolvedPkgs.lib; {
          CI = mkOverride 1001 "false"; # true iff running in a CI environment
          LOCAL_DEV_NAMESPACE = mkOverride 1001 "@INVALID@";
        };

        enterShell = mkIf local ''
          source enter-shell-local
        '';

        scripts = {
          terraform.exec =
            "tofu $@"; # Alias terraform with tofu to prevent confusion
        };

        # Combine the base packages with some extra packages meant for local development only
        packages = (import ../packages {
          inherit forEachSystem;
          nixpkgs = panfactumPkgs;
        }).${system} ++ (with panfactumResolvedPkgs; [
          ####################################
          # Devenv Setup
          ####################################
          (util.customShellScript "enter-shell-local")
          (import ./setup { pkgs = panfactumResolvedPkgs; })
          (util.customShellScript
            "pf-env-scaffold") # helper for the bootstrapping guide
          (util.customShellScript
            "pf-env-bootstrap") # helper for the bootstrapping guide
          (util.customShellScript
            "pf-providers-enable") # helper for setting up providers in module.yaml

          ####################################
          # Postgres Management
          ####################################
          pgadmin

          ####################################
          # Container Management
          ####################################
          src2.podman # container management CLI
          tilt # local CI tool for building and deploying containers
        ]);
      };
  in {
    default = devenv.lib.mkShell {
      inherit inputs;
      pkgs = userResolvedPkgs;
      modules = [ base ] ++ modules;
    };
  }))
