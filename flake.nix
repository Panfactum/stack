{
  description =
    "Local development utilities for working with the Panfactum stack";

  inputs = {
    nixpkgs.url =
      "github:NixOS/nixpkgs/c0b1da36f7c34a7146501f684e9ebdf15d2bebf8";
    flake-utils.url = "github:numtide/flake-utils";
    kubeUtilsPkgsSrc.url =
      "github:NixOS/nixpkgs/92d295f588631b0db2da509f381b4fb1e74173c5";
    awsUtilsPkgsSrc.url =
      "github:NixOS/nixpkgs/658e7223191d2598641d50ee4e898126768fe847";
    tfUtilsPkgsSrc.url =
      "github:NixOS/nixpkgs/73bed75dbd3de6d4fca3f81ce25a0cc7766afff6";
    buildkitPkgsSrc.url =
      "github:NixOS/nixpkgs/b60793b86201040d9dee019a05089a9150d08b5b";
    redisPkgsSrc.url =
      "github:NixOS/nixpkgs/f7207adcc68d9cafa29e3cd252a18743ae512c6a";
    postgresPkgsSrc.url =
      "github:NixOS/nixpkgs/daf7bb95821b789db24fc1ac21f613db0c1bf2cb";
    vaultPkgsSrc.url =
      "github:NixOS/nixpkgs/325eb628b89b9a8183256f62d017bfb499b19bd9";
    linkerdPkgsSrc.url =
      "github:NixOS/nixpkgs/3281bec7174f679eabf584591e75979a258d8c40";
  };

  outputs = { nixpkgs, flake-utils, kubeUtilsPkgsSrc, awsUtilsPkgsSrc
    , tfUtilsPkgsSrc, buildkitPkgsSrc, redisPkgsSrc, postgresPkgsSrc
    , vaultPkgsSrc, linkerdPkgsSrc, ... }@inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = { allowUnfree = true; };
        };
        kubeUtilsPkgs = import kubeUtilsPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        awsUtilsPkgs = import awsUtilsPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        tfUtilsPkgs = import tfUtilsPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        buildkitPkgs = import buildkitPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        redisPkgs = import redisPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        postgresPkgs = import postgresPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        vaultPkgs = import vaultPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        linkerdPkgs = import linkerdPkgsSrc {
          inherit system;
          config = { allowUnfree = true; };
        };
        panfactumPackages = import ./packages/nix/packages {
          inherit pkgs kubeUtilsPkgs awsUtilsPkgs tfUtilsPkgs buildkitPkgs
            redisPkgs postgresPkgs vaultPkgs linkerdPkgs;
        };

        localDevShell = import ./packages/nix/localDevShell { inherit pkgs; };

        mkDevShell = { name ? "devShell", packages ? [ ], shellHook ? ""
          , activateDefaultShellHook ? true, }:
          pkgs.mkShell {
            name = name;
            buildInputs = panfactumPackages ++ packages;
            shellHook = ''
              ${if activateDefaultShellHook then
                "source enter-shell-local"
              else
                ""}
              ${shellHook}
            '';
          };
      in {
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
              Env = [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
              ];
              Entrypoint = [ "/bin/bash" ];
            };
          };
        };

        lib = { inherit mkDevShell; };

        formatter = pkgs.nixfmt-rfc-style;

        devShell = mkDevShell {
          activateDefaultShellHook = false;
          shellHook = localDevShell.shellHook;
          packages = localDevShell.packages;
        };
      });
}
