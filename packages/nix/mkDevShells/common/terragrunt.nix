let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/58ae79ea707579c40102ddf62d84b902a987c58b.tar.gz";
    sha256 =
      "10ksg8w1wm6nkrihvqicyxfrdbj79q0j2wn5jyzdkvxr3jw36gj5"; # Update if using a different commit
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.terragrunt
