{
  description =
    "Local development utilities for working with the Panfactum stack";

  inputs = {
    nixpkgs.url =
      "github:NixOS/nixpkgs/599b4a1abd630f6a280cb9fe5ad8aae94ffe5655";
    systems.url = "github:nix-systems/default";
    devenv.url =
      "github:cachix/devenv/34e6461fd76b5f51ad5f8214f5cf22c4cd7a196e"; # v1.0.5
    devenv.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, devenv, systems, ... }@inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
      mkDevShells = import ./packages/nix/mkDevShells {
        inherit forEachSystem devenv inputs;
        panfactumPkgs = nixpkgs;
      };
    in {
      packages = forEachSystem (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          image = pkgs.dockerTools.buildImage {
            name = "panfactum";
            tag = "latest";

            copyToRoot = pkgs.buildEnv {
              name = "image-root";
              paths = (import ./packages/nix/packages {
                inherit nixpkgs forEachSystem;
              }).${system};
              pathsToLink = [ "/bin" ];
            };

            config = {
              Env = [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
              ];
              Entrypoint = [ "/bin/bash" ];
            };
          };
        });

      lib = { inherit mkDevShells forEachSystem; };

      formatter =
        forEachSystem (system: nixpkgs.legacyPackages.${system}.nixpkgs-fmt);

      devShells = forEachSystem (system: {
        default = devenv.lib.mkShell {

          inherit inputs;
          pkgs = nixpkgs.legacyPackages.${system};
          modules = [ (import ./packages/nix/devenv { inherit system; }) ];
        };
      });
    };
}
