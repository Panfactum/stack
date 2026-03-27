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

dependency "authentik_core" {
  config_path = "../authentik_core_resources"
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

inputs = {
  aws_acs_url      = "https://us-east-2.signin.aws.amazon.com/platform/saml/acs/95dd9da3-94ec-448b-9449-6564c5630e9b"
  aws_sign_in_url  = "https://panfactum.awsapps.com/start"
  aws_issuer       = "https://us-east-2.signin.aws.amazon.com/platform/saml/d-9a6709eac6"
  aws_scim_enabled = true
  aws_scim_url     = "https://scim.us-east-2.amazonaws.com/Hw59fdecb43-083d-4307-b59f-ef4a9eb90ca6/scim/v2/"
  aws_scim_token   = local.secrets.aws_scim_token

  organization_name   = dependency.authentik_core.outputs.organization_name
  authentik_namespace = dependency.kube_authentik.outputs.namespace
  media_configmap     = dependency.kube_authentik.outputs.media_configmap
  authentik_domain    = dependency.kube_authentik.outputs.domain

  allowed_groups = [
    "superusers",
    "privileged_engineers",
    "engineers",
    "restricted_engineers",
    "billing_admins",
    "demo_users"
  ]
}
