{ pkgs }:
let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchTarball {
    url =
      "https://github.com/NixOS/nixpkgs/archive/a343533bccc62400e8a9560423486a3b6c11a23b.tar.gz";
    sha256 =
      "0103a1a1g5sp4bjhm6fl0nfw69jgdiwrwz96nnqi0f3bg6vcg1sf"; # Update if using a different commit
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
