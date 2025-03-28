include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "vault" {
  config_path = "../kube_vault"
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

dependency "s3_destination" {
  config_path = "../airbyte_s3_destination"
}

inputs = {
  domain       = "airbyte.prod.panfactum.com"
  vault_domain = dependency.vault.outputs.vault_domain
  admin_email  = "james@panfactum.com"

  connected_s3_bucket_arns = [
    dependency.s3_destination.outputs.bucket_arn
  ]
}