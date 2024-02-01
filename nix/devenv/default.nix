{ config, pkgs, ... }:
let
  customNixModule = module: import ./${module}.nix { inherit pkgs; };
  customShellScript = name:
    (pkgs.writeShellScriptBin name (builtins.readFile ./${name}.sh));
in {
  env = {
    TERRAFORM_COMMON_FILES_DIR =
      "${config.env.DEVENV_ROOT}/terraform/common_files";
    TERRAFORM_MODULES_DIR = "${config.env.DEVENV_ROOT}/terraform/modules";
    TERRAFORM_LIVE_DIR = "${config.env.DEVENV_ROOT}/terraform/live";
  };
  packages = with pkgs; [
    jq
    hcl2json
    shellcheck
    shfmt
    nixfmt
    (customShellScript "lint")
  ];
  pre-commit.hooks = {
    terraform-custom = {
      enable = true;
      entry = "precommit-terraform-fmt";
      description = "Terraform linting";
      files = "^packages/infrastructure/(.*).tf$";
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
