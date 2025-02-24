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

inputs = {
  alert_email        = "it@panfactum.com"
  vault_internal_url = dependency.vault.outputs.vault_internal_url

  route53_zones = {
    "seth.panfactum.com" = {
      zone_id                 = "Z02435591AMBQOV5HVZS3"
      record_manager_role_arn = "arn:aws:iam::471112902605:role/route53-record-manager-20240405144117207000000006"
    }
  }
}