let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/9a9dae8f6319600fa9aebde37f340975cab4b8c0.tar.gz";
    sha256 =
      "10rdlaw5lki6ic33m4gc02701a0x6v634hrwd06yspknxgzcvgl4"; # Update if using a different commit
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.helm
