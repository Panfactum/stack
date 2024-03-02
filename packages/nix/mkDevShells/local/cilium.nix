{ pkgs }:
pkgs.symlinkJoin {
  name = "cilium-cli";
  paths = [ pkgs.cilium-cli ];
  buildInputs = [ pkgs.makeWrapper ];
  postBuild = ''
    wrapProgram $out/bin/cilium \
      --add-flags "-n cilium"
  '';
}
