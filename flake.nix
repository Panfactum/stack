{
  description =
    "Local development utilities for working with the Panfactum stack";

  inputs = {
    nixpkgs.url =
      "github:NixOS/nixpkgs/c0b1da36f7c34a7146501f684e9ebdf15d2bebf8";
    systems.url = "github:nix-systems/default";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, systems, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = { allowUnfree = true; };
        };
        #      mkDevShells = import ./packages/nix/mkDevShells {
        #        inherit forEachSystem devenv inputs;
        #        panfactumPkgs = nixpkgs;
        #      };
        panfactumPackages =
          import ./packages/nix/packages { inherit nixpkgs system; };
      in {
        packages = {
          # See https://github.com/NixOs/nixpkgs/pull/122608 for future optimizations
          image = pkgs.dockerTools.streamLayeredImage {
            name = "panfactum";
            tag = "latest";

            contents = with pkgs.dockerTools; [
              (pkgs.buildEnv {
                name = "image-root";
                paths = panfactumPackages.${system};
                pathsToLink = [ "/bin" ];
              })
              usrBinEnv
              binSh
              caCertificates
              fakeNss
            ];
            maxLayers = 125;

            config = {
              Env = [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
              ];
              Entrypoint = [ "/bin/bash" ];
            };
          };
        };

        formatter = nixpkgs.legacyPackages.${system}.nixpkgs-fmt;

        devShell = pkgs.mkShell {
          name = "devShell";
          buildInputs = panfactumPackages;
          shellHook = ''
            export REPO_ROOT=$(git rev-parse --show-toplevel)
            export GOPATH=$REPO_ROOT/go
          '';
        };

        #        default = devenv.lib.mkShell {
        #
        #          inherit inputs;
        #          pkgs = nixpkgs.legacyPackages.${system};
        #          modules = [ (import ./packages/nix/devenv { inherit system; }) ];
        #        };
      });
}
