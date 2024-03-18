{ pkgs }:
let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/a343533bccc62400e8a9560423486a3b6c11a23b.tar.gz";
    sha256 =
      "10rdlaw5lki6ic33m4gc02701a0x6v634hrwd06yspknxgzcvgl4"; # Update if using a different commit
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.symlinkJoin {
  name = "cilium-cli";
  paths = [ pkgs.cilium-cli ];
  buildInputs = [ pkgs.makeWrapper ];
  postBuild = ''
    wrapProgram $out/bin/cilium \
      --add-flags "-n cilium"
  '';
}
