let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "58ae79ea707579c40102ddf62d84b902a987c58b";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.terraform
