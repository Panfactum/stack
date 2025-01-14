{ pkgs }:
{

  shellHook = ''
    export REPO_ROOT=$(git rev-parse --show-toplevel)
    export TERRAFORM_MODULES_DIR="$REPO_ROOT/packages/infrastructure";
    export PF_IAC_DIR="$REPO_ROOT/packages/infrastructure";
    export GOBIN="$REPO_ROOT/go/bin";
    export GOPATH="$REPO_ROOT/go";
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
  ];

  pre-commit.hooks = {
    terraform-custom = {
      enable = true;
      fail_fast = true;
      entry = "precommit-terraform-fmt";
      description = "Terraform linting";
      files = "^packages/infrastructure/(.*).tf$";
    };
    terragrunt-custom = {
      enable = true;
      fail_fast = true;
      entry = "precommit-terragrunt-fmt";
      description = "Terragrunt linting";
      files = "^packages/(nix|reference)/(.*).hcl$";
    };
    terraform-docs = {
      enable = true;
      fail_fast = true;
      entry = "precommit-terraform-docs";
      description = "Terraform documentation generate";
      files = "^packages/infrastructure/(.*)$";
      pass_filenames = false;
    };
    nixfmt = {
      enable = true;
      fail_fast = true;
      description = "Nix linting";
    };
    shellcheck = {
      enable = true;
      fail_fast = true;
      description = "Shell code linting";
    };
    shfmt = {
      enable = true;
      fail_fast = true;
      description = "Shell code formatting";
    };
    website = {
      enable = true;
      fail_fast = true;
      entry = "precommit-website";
      description = "Checks for website";
      files = "^packages/(website|eslint)/(.*)";
      pass_filenames = false;
    };
    cspell-custom = {
      enable = true;
      fail_fast = true;
      entry = "precommit-spellcheck";
      description = "Spellchecker";
      files = "(.*).(md|mdx)$";
      pass_filenames = false;
    };
  };
}
