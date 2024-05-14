{ config, pkgs, ... }:
let
  customNixModule = module: import ./${module}.nix { inherit pkgs; };
  customShellScript = name:
    (pkgs.writeShellScriptBin name (builtins.readFile ./${name}.sh));
in {
  env = {
    TERRAFORM_MODULES_DIR = "${config.env.DEVENV_ROOT}/packages/infrastructure";
  };
  packages = with pkgs; [

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
    (import ../mkDevShells/common/opentofu.nix)
    (import ../mkDevShells/common/terragrunt.nix)
    (import ../mkDevShells/common/kubectl.nix)
    terraform-docs
    (customShellScript "generate-tf-docs")
    (customShellScript "generate-tf-common")
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
      entry = "precommit-terraform-fmt";
      description = "Terraform linting";
      files = "^packages/infrastructure/(.*).tf$";
    };
    terragrunt-custom = {
      enable = true;
      entry = "precommit-terragrunt-fmt";
      description = "Terragrunt linting";
      files = "^packages/(nix|reference)/(.*).hcl$";
    };
    terraform-docs = {
      enable = true;
      entry = "precommit-terraform-docs";
      description = "Terraform documentation generate";
      files = "^packages/infrastructure/(.*)$";
      pass_filenames = false;
    };
    nixfmt = {
      enable = true;
      description = "Nix linting";
    };
    shellcheck = {
      enable = true;
      description = "Shell code linting";
    };
    shfmt = {
      enable = true;
      description = "Shell code formatting";
    };
    website = {
      enable = true;
      entry = "precommit-website";
      description = "Checks for website";
      files = "^packages/(website|eslint)/(.*)";
      pass_filenames = false;
    };
    cspell-custom = {
      enable = true;
      entry = "precommit-spellcheck";
      description = "Spellchecker";
      files = "(.*).(md|mdx)$";
      pass_filenames = false;
    };
  };
}
