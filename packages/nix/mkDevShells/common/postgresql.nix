let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "807c549feabce7eddbf259dbdcec9e0600a0660d";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.postgresql_16
