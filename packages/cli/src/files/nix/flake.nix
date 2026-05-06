{
  description = "Panfactum __ENV_NAME__ environment devshell";

  inputs = {
    panfactum.url = "path:../..";
    flake-utils.follows = "panfactum/flake-utils";
  };

  outputs =
    { panfactum, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system: {
      devShells.default = panfactum.lib.${system}.mkDevShell {
        name = "__ENV_NAME__-environment";
      };
    });
}
