let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "9a9dae8f6319600fa9aebde37f340975cab4b8c0";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.kustomize
