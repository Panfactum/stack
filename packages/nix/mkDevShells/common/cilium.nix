let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "a343533bccc62400e8a9560423486a3b6c11a23b";
    shallow = true;
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
