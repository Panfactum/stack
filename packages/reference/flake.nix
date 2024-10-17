{
  inputs = {
    #panfactum.url = "github:panfactum/stack/main";
    panfactum.url =
      "path:../.."; # When developing locally, use this to test changes, but don't forget to change it back before committing!
    flake-utils.url = "github:numtide/flake-utils";

  };

  outputs = { panfactum, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem
    (system: { devShell = panfactum.lib.${system}.mkDevShell { }; });
}
