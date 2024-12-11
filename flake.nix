{
  description = "Local development utilities for working with the Panfactum stack";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/c0b1da36f7c34a7146501f684e9ebdf15d2bebf8";
    flake-utils.url = "github:numtide/flake-utils";
    kubeUtilsPkgsSrc.url = "github:NixOS/nixpkgs/0cb2fd7c59fed0cd82ef858cbcbdb552b9a33465";
    awsUtilsPkgsSrc.url = "github:NixOS/nixpkgs/566e53c2ad750c84f6d31f9ccb9d00f823165550";
    tfUtilsPkgsSrc.url = "github:NixOS/nixpkgs/93dc9803a1ee435e590b02cde9589038d5cc3a4e";
    buildkitPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    redisPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    postgresPkgsSrc.url = "github:NixOS/nixpkgs/daf7bb95821b789db24fc1ac21f613db0c1bf2cb";
    vaultPkgsSrc.url = "github:NixOS/nixpkgs/325eb628b89b9a8183256f62d017bfb499b19bd9";
    linkerdPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    kyvernoPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    natsPkgsSrc.url = "github:NixOS/nixpkgs/34a626458d686f1b58139620a8b2793e9e123bba";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      kubeUtilsPkgsSrc,
      awsUtilsPkgsSrc,
      tfUtilsPkgsSrc,
      buildkitPkgsSrc,
      redisPkgsSrc,
      postgresPkgsSrc,
      vaultPkgsSrc,
      linkerdPkgsSrc,
      kyvernoPkgsSrc,
      natsPkgsSrc,
      ...
    }@inputs:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        kubeUtilsPkgs = import kubeUtilsPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        awsUtilsPkgs = import awsUtilsPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        tfUtilsPkgs = import tfUtilsPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        buildkitPkgs = import buildkitPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        redisPkgs = import redisPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        postgresPkgs = import postgresPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        vaultPkgs = import vaultPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        linkerdPkgs = import linkerdPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        kyvernoPkgs = import kyvernoPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        natsPkgs = import natsPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        panfactumPackages = import ./packages/nix/packages {
          inherit
            pkgs
            kubeUtilsPkgs
            awsUtilsPkgs
            tfUtilsPkgs
            buildkitPkgs
            redisPkgs
            postgresPkgs
            vaultPkgs
            linkerdPkgs
            kyvernoPkgs
            natsPkgs
            ;
        };

        localDevShell = import ./packages/nix/localDevShell { inherit pkgs; };

        mkDevShell =
          {
            name ? "devShell",
            packages ? [ ],
            shellHook ? "",
            activateDefaultShellHook ? true,
          }:
          pkgs.mkShell {
            name = name;
            buildInputs = panfactumPackages ++ packages;
            shellHook = ''
              ${if activateDefaultShellHook then "source enter-shell-local" else ""}
              ${shellHook}
            '';
          };
      in
      {
        packages = {
          # See https://github.com/NixOs/nixpkgs/pull/122608 for future optimizations
          image = pkgs.dockerTools.streamLayeredImage {
            name = "panfactum";
            tag = "latest";

            contents = with pkgs.dockerTools; [
              (pkgs.buildEnv {
                name = "image-root";
                paths = panfactumPackages;
                pathsToLink = [ "/bin" ];
              })
              usrBinEnv
              binSh
              caCertificates
              fakeNss
            ];
            maxLayers = 125;

            config = {
              Env = [ "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" ];
              Entrypoint = [ "/bin/bash" ];
            };
          };
        };

        lib = {
          inherit mkDevShell;
        };

        formatter = pkgs.nixfmt-rfc-style;

        devShell = mkDevShell {
          activateDefaultShellHook = false;
          shellHook = localDevShell.shellHook;
          packages = localDevShell.packages;
        };
      }
    );
}
