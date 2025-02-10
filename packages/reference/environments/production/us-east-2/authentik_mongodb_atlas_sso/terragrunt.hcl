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
  acs_url     = "https://auth.mongodb.com/sso/saml2/0oaw7vqdsehzxtqZ1297"
  audience    = "https://www.okta.com/saml2/service-provider/spzsbkposqvrzhbjcdnz"
  issuer      = dependency.kube_authentik.outputs.authentik_url

  organization_name   = dependency.authentik_core.outputs.organization_name
  authentik_namespace = dependency.kube_authentik.outputs.namespace
  media_configmap     = dependency.kube_authentik.outputs.media_configmap
  authentik_domain    = dependency.kube_authentik.outputs.domain
}

