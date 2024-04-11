include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  aws_acs_url       = "https://us-east-2.signin.aws.amazon.com/platform/saml/acs/95dd9da3-94ec-448b-9449-6564c5630e9b"
  aws_sign_in_url   = "https://panfactum.awsapps.com/start"
  aws_issuer        = "https://us-east-2.signin.aws.amazon.com/platform/saml/d-9a6709eac6"
  aws_scim_enabled  = true
  aws_scim_url      = "https://scim.us-east-2.amazonaws.com/Hw5bd5d4dbf-8ea6-49c9-b7d1-43f901bf1bbc/scim/v2/"
  aws_scim_token    = local.secrets.aws_scim_token
  organization_name = "Panfactum"
  authentik_domain  = "authentik.panfactum.com"
  allowed_groups    = []
}
