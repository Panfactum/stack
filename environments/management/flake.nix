{
  description = "Panfactum management environment devshell";

  inputs = {
    panfactum.url = "path:../..";
    flake-utils.follows = "panfactum/flake-utils";
  };

  outputs =
    { panfactum, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system: {
        devShells.default = panfactum.lib.${system}.mkDevShell {
          name = "management-environment";
        };
      }
    );
}
