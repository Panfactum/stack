let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "a3ed7406349a9335cb4c2a71369b697cecd9d351";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.ssm-session-manager-plugin
