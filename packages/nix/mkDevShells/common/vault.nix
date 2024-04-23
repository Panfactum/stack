let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "325eb628b89b9a8183256f62d017bfb499b19bd9";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.vault
