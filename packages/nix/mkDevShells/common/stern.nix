let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "5710127d9693421e78cca4f74fac2db6d67162b1";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.stern
