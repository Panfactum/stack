let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "c726225724e681b3626acc941c6f95d2b0602087";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.awscli2
