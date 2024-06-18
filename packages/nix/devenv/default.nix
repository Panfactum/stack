{ system }:
{ config, pkgs, ... }:
let
  customNixModule = module: import ./${module}.nix { inherit pkgs; };
  customShellScript = name:
    (pkgs.writeShellScriptBin name (builtins.readFile ./${name}.sh));
  src3 = import (pkgs.fetchFromGitHub {
    owner = "NixOS";
    repo = "nixpkgs";
    rev = "a343533bccc62400e8a9560423486a3b6c11a23b";
    sha256 = "TofHtnlrOBCxtSZ9nnlsTybDnQXUmQrlIleXF1RQAwQ=";
  }) { inherit system; };
  src7 = import (pkgs.fetchFromGitHub {
    owner = "NixOS";
    repo = "nixpkgs";
    rev = "a3ed7406349a9335cb4c2a71369b697cecd9d351";
    sha256 = "PDwAcHahc6hEimyrgGmFdft75gmLrJOZ0txX7lFqq+I=";
  }) { inherit system; };
  src5 = import (pkgs.fetchFromGitHub {
    owner = "NixOS";
    repo = "nixpkgs";
    rev = "9a9dae8f6319600fa9aebde37f340975cab4b8c0";
    sha256 = "hL7N/ut2Xu0NaDxDMsw2HagAjgDskToGiyZOWriiLYM=";
  }) { inherit system; };
in {
  env = {
    TERRAFORM_MODULES_DIR = "${config.env.DEVENV_ROOT}/packages/infrastructure";
    PF_SKIP_IAC_REF_UPDATE = "1";
    PF_IAC_DIR = "${config.env.DEVENV_ROOT}/packages/infrastructure";
  };
  packages = with pkgs; [

    ####################################
    # We use the setup utilities for templating
    # in the main repo
    ####################################
    (import ../mkDevShells/setup { inherit pkgs; })

    ####################################
    # Programming Langauges
    ####################################
    nodejs_20
    nodePackages_latest.pnpm # nodejs package manager

    ####################################
    # Version Control
    ####################################
    git # vcs CLI
    git-lfs # stores binary files in git host

    #########################################
    # Script Utilities
    #########################################
    jq
    hcl2json
    gawk
    yq

    #########################################
    # IaC Tools
    #########################################
    src3.opentofu
    src7.terragrunt
    src5.kubectl
    terraform-docs
    (customShellScript "generate-tf-docs")
    (customShellScript "generate-tf")

    #########################################
    # Linters
    #########################################
    shellcheck
    shfmt
    nixfmt
    nodePackages.cspell
    (customShellScript "precommit-spellcheck")
    (customShellScript "precommit-terraform-fmt")
    (customShellScript "precommit-terragrunt-fmt")
    (customShellScript "precommit-terraform-docs")
    (customShellScript "precommit-website")
    (customShellScript "lint")

    #########################################
    # CI / CD
    #########################################
    (customShellScript "build-panfactum-image")
  ];

  dotenv.enable = true;

  scripts = {
    # We use pnpm instead of npm
    npm.exec = "pnpm $@";

    # Login to GHCR for publishing imagess
    ghcr-login.exec =
      "echo $GITHUB_TOKEN | podman login ghcr.io -u fullykubed --password-stdin";
  };

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
