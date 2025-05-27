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

// todo: none of these inputs should be required
inputs = {
  authentik_namespace = dependency.kube_authentik.outputs.namespace
  media_configmap     = dependency.kube_authentik.outputs.media_configmap
  organization_name   = dependency.authentik_core.outputs.organization_name
  authentik_domain    = dependency.kube_authentik.outputs.domain

  // todo: move to module.yaml as an input
  # Provide *all* the groups that you want to allow to access the particular Vault cluster (we will assign roles later).
  allowed_groups = [
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers"
  ]
}
