{ pkgs }:
{

  shellHook = ''
    export REPO_ROOT=$(git rev-parse --show-toplevel)
    export TERRAFORM_MODULES_DIR="$REPO_ROOT/packages/infrastructure";
    export PF_IAC_DIR="$REPO_ROOT/packages/infrastructure";
    export GOBIN="$REPO_ROOT/go/bin";
    export GOPATH="$REPO_ROOT/go";
    pre-commit install -c "$REPO_ROOT/.pre-commit-config.yaml"
  '';

  packages = with pkgs; [
    ####################################
    # Custom Scripts
    ####################################
    (import ./scripts { inherit pkgs; })

    ####################################
    # Programming Langauges
    ####################################
    nodejs_22
    nodePackages_latest.pnpm # nodejs package manager
    go
    upx # compressing go binaries

    ####################################
    # Version Control
    ####################################
    git # vcs CLI
    git-lfs # stores binary files in git host

    #########################################
    # IaC Tools
    #########################################
    terraform-docs

    #########################################
    # Linters
    #########################################
    shellcheck
    shfmt
    nixfmt-rfc-style
    nodePackages.cspell
    pre-commit
  ];

  pre-commit.hooks = {
    terragrunt-custom = {
      enable = true;
      fail_fast = true;
      entry = "precommit-terragrunt-fmt";
      description = "Terragrunt linting";
      files = "^packages/(nix|reference)/(.*).hcl$";
    };
    nixfmt = {
      enable = true;
      fail_fast = true;
      description = "Nix linting";
    };
  };
}
