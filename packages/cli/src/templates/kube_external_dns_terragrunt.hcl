include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cert_issuers" {
  config_path = "../kube_cert_issuers"
}

inputs = {
  route53_zones = dependency.cert_issuers.outputs.route53_zones
}
