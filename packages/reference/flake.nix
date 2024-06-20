{
  inputs = {
    panfactum.url = "github:panfactum/stack/main";
    #panfactum.url = "path:../.."; # When developing locally, use this to test changes, but don't forget to change it back before committing!
    pkgs.url = "github:NixOS/nixpkgs/nixos-23.11";
  };

  outputs = { self, panfactum, pkgs, ... }@inputs: {
    devShells = panfactum.lib.mkDevShells {
      inherit pkgs;
      modules = [ (import ./devenv.nix) ];
    };
  };
}
