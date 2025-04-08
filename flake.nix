{
  description = "Local development utilities for working with the Panfactum stack";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    flake-utils.url = "github:numtide/flake-utils";
    kubeUtilsPkgsSrc.url = "github:NixOS/nixpkgs/0cb2fd7c59fed0cd82ef858cbcbdb552b9a33465";
    awsUtilsPkgsSrc.url = "github:NixOS/nixpkgs/f27ec3a00d953eaf96c5ecdcd64bc30c44a20315";
    tfUtilsPkgsSrc.url = "github:NixOS/nixpkgs/93dc9803a1ee435e590b02cde9589038d5cc3a4e";
    buildkitPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    redisPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    postgresPkgsSrc.url = "github:NixOS/nixpkgs/16e046229f3b4f53257973a5532bcbb72457d2f2";
    vaultPkgsSrc.url = "github:NixOS/nixpkgs/325eb628b89b9a8183256f62d017bfb499b19bd9";
    linkerdPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    kyvernoPkgsSrc.url = "github:NixOS/nixpkgs/226216574ada4c3ecefcbbec41f39ce4655f78ef";
    natsPkgsSrc.url = "github:NixOS/nixpkgs/34a626458d686f1b58139620a8b2793e9e123bba";
    bunPkgsSrc.url = "github:NixOS/nixpkgs/573c650e8a14b2faa0041645ab18aed7e60f0c9a";
    bun2nix = {
      url = "github:baileyluTCD/bun2nix/b23a63c44bba437a37f012e5bcbf0f06bb902f17";
      inputs = {
        nixpkgs.follows = "bunPkgsSrc";
        flake-utils.follows = "flake-utils";
      };
    };
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
      bunPkgsSrc,
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
        bunPkgs = import bunPkgsSrc {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        bun2nix = inputs.bun2nix.defaultPackage.${system};
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
            bunPkgs
            bun2nix
            ;
        };

        localDevShell = import ./packages/nix/localDevShell { inherit pkgs bunPkgs bun2nix; };

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
