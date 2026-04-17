{
  description = "OpenTofu / Terraform provider for Panfactum";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    terraform-src.url = "github:NixOS/nixpkgs/73bed75dbd3de6d4fca3f81ce25a0cc7766afff6";
    go-src.url = "github:NixOS/nixpkgs/5ed627539ac84809c78b2dd6d26a5cebeb5ae269";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, terraform-src, go-src, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        tf-pkgs = import terraform-src {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        go-pkgs = import go-src {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
      in
      {
        devShell = pkgs.mkShell {
          name = "devShell";
          buildInputs = with pkgs; [
            tf-pkgs.opentofu
            tf-pkgs.terraform
            go-pkgs.go_1_22
          ];
          shellHook = ''
            export REPO_ROOT=$(git rev-parse --show-toplevel)
            export GOPATH=$REPO_ROOT/go
          '';
        };
      }
    );
}