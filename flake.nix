{
  description =
    "Local development utilities for working with the Panfactum stack";

  inputs = {
    nixpkgs.url =
      "github:NixOS/nixpkgs/6608f1624a8dd9d001de8fc24baa9a2d929b0e82";
    systems.url = "github:nix-systems/default";
    devenv.url = "github:cachix/devenv/python-rewrite";
  };

  nixConfig = {
    extra-trusted-public-keys =
      "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };

  outputs = { self, nixpkgs, devenv, systems, ... }@inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
      mkDevShells =
        import ./nix/mkDevShells { inherit nixpkgs systems devenv inputs; };
    in {
      packages = forEachSystem (system: {
        devenv-up = self.devShells.${system}.default.config.procfileScript;
      });

      lib = { inherit mkDevShells; };

      formatter =
        forEachSystem (system: nixpkgs.legacyPackages.${system}.nixpkgs-fmt);

      devShells = mkDevShells [ (import ./nix/devenv) ];
    };
}
