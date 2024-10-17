{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils"; # Utility for generating flakes that are compatible with all operating systems
    #panfactum.url = "github:panfactum/stack/main";
    panfactum.url = "path:../.."; # When developing locally, use this to test changes, but don't forget to change it back before committing!
  };

  outputs =
    { panfactum, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem (system: {
      devShell = panfactum.lib.${system}.mkDevShell { };
    });
}
