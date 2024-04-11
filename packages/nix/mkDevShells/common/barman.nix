let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "20bc93ca7b2158ebc99b8cef987a2173a81cde35";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.barman
