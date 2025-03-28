include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cert_manager" {
  config_path  = "../kube_cert_manager"
  skip_outputs = true
}

dependency "vault_core" {
  config_path  = "../vault_core_resources"
  skip_outputs = true
}

dependency "vault" {
  config_path = "../kube_vault"
}

dependency "registered_domains" {
  config_path = "../../global/aws_registered_domains"
}

dependency "delegated_zones" {
  config_path = "../../global/aws_delegated_zones_production"
}

inputs = {
  alert_email        = ""
  vault_internal_url = dependency.vault.outputs.vault_internal_url

  route53_zones = {
  }
}


