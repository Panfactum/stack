let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/58ae79ea707579c40102ddf62d84b902a987c58b.tar.gz";
    sha256 =
      "10rdlaw5lki6ic33m4gc02701a0x6v634hrwd06yspknxgzcvgl4"; # Update if using a different commit
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.terragrunt
