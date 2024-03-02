# Add your custom development setup here
# See all available options here: https://devenv.sh/reference/options/
{ config, pkgs, ... }: {
  env = {
    PF_ENVIRONMENTS_DIR = "environments";
    PF_REPO_URL = "github.com/panfactum/stack";
    PF_REPO_NAME = "stack";
    PF_REPO_PRIMARY_BRANCH = "main";
    PF_TERRAFORM_DIR = "packages/reference/terraform";
  };
}
