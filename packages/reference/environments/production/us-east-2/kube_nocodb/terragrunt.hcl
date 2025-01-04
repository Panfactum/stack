include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cnpg" {
  config_path  = "../kube_cloudnative_pg"
  skip_outputs = true
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

dependency "ses_domain" {
  config_path = "../aws_ses_domain"
}

inputs = {
  ingress_enabled = true

  domain = "nocodb.panfactum.com"

  superuser_email = "it@panfactum.com"
}

skip = true