{
  pkgs,
  bunPkgs,
  bun2nix,
}:
{

  shellHook = ''
    export REPO_ROOT=$(git rev-parse --show-toplevel)
    export TERRAFORM_MODULES_DIR="$REPO_ROOT/packages/infrastructure";
    export PF_IAC_DIR="$REPO_ROOT/packages/infrastructure";
    export GOBIN="$REPO_ROOT/go/bin";
    export GOPATH="$REPO_ROOT/go";
    prek install -c "$REPO_ROOT/.pre-commit-config.yaml"
    pnpm install --recursive --frozen-lockfile --prefer-offline --silent &
    bun install --silent --frozen-lockfile &
  '';

  packages = with pkgs; [
    ####################################
    # Custom Scripts
    ####################################
    (import ./scripts { inherit pkgs; })

    ####################################
    # Programming Langauges
    ####################################
    nodejs_25 # nodejs runtime
    nodePackages_latest.pnpm # nodejs package manager
    go # go programming language
    upx # compressing go binaries
    bunPkgs.bun # bun runtime
    bun2nix.bin # utility for building nix derivations from bun projects
    uv # Installing python utilities

    ####################################
    # Version Control
    ####################################
    git # vcs CLI
    git-lfs # stores binary files in git host

    #########################################
    # IaC Tools
    #########################################
    terraform-docs # tool for generating documentation from terraform modules

    #########################################
    # Linters
    #########################################
    shellcheck
    shfmt
    nixfmt-rfc-style
    nodePackages.cspell
    prek
  ];
}
