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

  domain = "authentik.panfactum.com"

  smtp_host          = dependency.ses_domain.outputs.smtp_host
  smtp_user          = dependency.ses_domain.outputs.smtp_user
  smtp_password      = dependency.ses_domain.outputs.smtp_password
  email_from_address = "no-reply@panfactum.com"

  akadmin_email = "it@panfactum.com"
}