include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

locals {
  secrets          = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
  organization_url = "https://github.com/panfactum"
}

dependency "kube_gha" {
  config_path  = "../kube_gha"
  skip_outputs = true
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {
  github_token = local.secrets.github_token
  runners = {
    default = {
      github_config_url = local.organization_url
    }
    default-secondary = {
      github_config_url = local.organization_url
    }
  }
}
