let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "080a4a27f206d07724b88da096e27ef63401a504";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.terragrunt
