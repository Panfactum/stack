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
        let
          pkgs = nixpkgs.legacyPackages.${system};
          isArm = pkgs.lib.hasPrefix "aarch64" system;
          baseImage = pkgs.dockerTools.pullImage {
            imageName = "gcr.io/distroless/base-debian12";
            imageDigest = if isArm then "sha256:98088fae6231d8dc53541050bcd99d63f2bbeac7bc2878d8090f31c0ad98afab" else  "sha256:77618773587222150c59bcf9bffaf7a1e1caca9b1e00ff5b0d7f2614a51fb304";
            sha256 =  if isArm then "sha256-I/Pfi4sIn7YdIU5KFc3QQg2SIDRXBNwEZ1g4PAiyBgM=" else "sha256-I/Pfi4sIn7YdIU5KFc3QQg2SIDRXBNwEZ1g4PAiyBgM=";
          };
        in {
        # See https://github.com/NixOs/nixpkgs/pull/122608 for future optimizations
          image = pkgs.dockerTools.streamLayeredImage  {
            name = "panfactum";
            tag = "latest";
            fromImage = baseImage;

            contents = pkgs.buildEnv {
              name = "image-root";
              paths = (import ./packages/nix/packages {
                inherit nixpkgs forEachSystem;
              }).${system};
              pathsToLink = [ "/bin" ];
            };
            maxLayers = 125;

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
