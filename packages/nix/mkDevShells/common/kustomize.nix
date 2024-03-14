let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/9a9dae8f6319600fa9aebde37f340975cab4b8c0.tar.gz";
    sha256 =
      "10ksg8w1wm6nkrihvqicyxfrdbj79q0j2wn5jyzdkvxr3jw36gj5"; # Update if using a different commit
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.kustomize
