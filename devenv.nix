{ pkgs, config, inputs, ... }:
let

in
{
  env = with pkgs.lib; {
    TERRAFORM_COMMON_FILES_DIR = "${config.env.DEVENV_ROOT}/terraform/common_files";
    TERRAFORM_MODULES_DIR = "${config.env.DEVENV_ROOT}/terraform/modules";
    TERRAFORM_LIVE_DIR = "${config.env.DEVENV_ROOT}/terraform/live";
  };

  pre-commit.hooks = {
    terraform-custom = {
      enable = true;
      entry = "precommit-terraform-fmt";
      description = "Terraform linting";
      files = "^packages/infrastructure/(.*)\.tf$";
    };
  };

  packages = with pkgs; [
    jq 
    hcl2json
  ];
}
