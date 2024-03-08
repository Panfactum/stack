{ config, pkgs, ... }:
let
  customNixModule = module: import ./${module}.nix { inherit pkgs; };
  customShellScript = name:
    (pkgs.writeShellScriptBin name (builtins.readFile ./${name}.sh));
in {
  env = {
    TERRAFORM_MODULES_DIR = "${config.env.DEVENV_ROOT}/packages/terraform";
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

    #########################################
    # IaC Tools
    #########################################
    terraform
    terraform-docs
    (customShellScript "generate-tf-docs")

    #########################################
    # Linters
    #########################################
    shellcheck
    shfmt
    nixfmt
    (customShellScript "precommit-terraform-fmt")
    (customShellScript "precommit-terraform-docs")
    (customShellScript "lint")
  ];

  scripts = {
    # We use pnpm instead of npm
    npm.exec = "pnpm $@";
  };

  pre-commit.hooks = {
    terraform-custom = {
      enable = true;
      entry = "precommit-terraform-fmt";
      description = "Terraform linting";
      files = "^packages/terraform/(.*).tf$";
    };
    terraform-docs = {
      enable = true;
      entry = "precommit-terraform-docs";
      description = "Terraform documentation generate";
      files = "^packages/terraform/(.*)$";
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
  };
}
