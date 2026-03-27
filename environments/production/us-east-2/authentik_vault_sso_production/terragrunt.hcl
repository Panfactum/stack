include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

dependency "authentik_core" {
  config_path = "../authentik_core_resources"
}

inputs = {
  authentik_namespace = dependency.kube_authentik.outputs.namespace
  media_configmap     = dependency.kube_authentik.outputs.media_configmap
  organization_name   = dependency.authentik_core.outputs.organization_name
  authentik_domain    = dependency.kube_authentik.outputs.domain

  vault_name   = "vault-production"
  vault_domain = "vault.prod.panfactum.com"
  allowed_groups = [
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers",
    "demo_users"
  ]
}
