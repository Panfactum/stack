include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "authentik_core" {
  config_path = "../authentik_core_resources"
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  aws_scim_token = local.secrets.aws_scim_token

  organization_name   = dependency.authentik_core.outputs.organization_name
  authentik_namespace = dependency.kube_authentik.outputs.namespace
  media_configmap     = dependency.kube_authentik.outputs.media_configmap
  authentik_domain    = dependency.kube_authentik.outputs.domain

  allowed_groups = [
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers",
    "billing_admins"
  ]
}
