let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "e1d501922fd7351da4200e1275dfcf5faaad1220";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.terragrunt
