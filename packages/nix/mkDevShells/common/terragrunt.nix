# The wrapper serves the following purposes
# - Prevents LFS files from being downloaded
# - Sets up the provider cache when using run-all command (https://terragrunt.gruntwork.io/docs/features/provider-cache/)
let
  system = builtins.currentSystem;
  nixpkgsSrc = builtins.fetchGit {
    url = "https://github.com/NixOS/nixpkgs";
    rev = "92d295f588631b0db2da509f381b4fb1e74173c5";
    shallow = true;
  };
  pkgs = import nixpkgsSrc { inherit system; };
in pkgs.writeShellScriptBin "terragrunt" ''
  #!/bin/env bash

  export GIT_LFS_SKIP_SMUDGE=1
  for arg in "$@"
  do
      if [[ "$arg" == "run-all" ]]; then
          export TERRAGRUNT_PROVIDER_CACHE=1
          export TERRAGRUNT_PROVIDER_CACHE_DIR="$TF_PLUGIN_CACHE_DIR"
          ${pkgs.terragrunt}/bin/terragrunt "$@"
          exit 0
      fi
  done
  ${pkgs.terragrunt}/bin/terragrunt "$@"
''
