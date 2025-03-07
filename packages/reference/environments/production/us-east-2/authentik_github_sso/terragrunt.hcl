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

inputs = {
  acs_url = "https://github.com/enterprises/Panfactum/saml/consume"

  organization_name = dependency.authentik_core.outputs.organization_name
  authentik_domain  = dependency.kube_authentik.outputs.domain
}
