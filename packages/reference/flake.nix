{
  inputs = {
    panfactum.url = "/home/jack/repos/panfactum/stack";
    pkgs.url = "github:NixOS/nixpkgs/nixos-23.11";
  };

  outputs = { self, panfactum, pkgs, ... }@inputs: {
    devShells = panfactum.lib.mkDevShells {
      inherit pkgs;
      modules = [ (import ./devenv.nix) ];
    };
  };
}
