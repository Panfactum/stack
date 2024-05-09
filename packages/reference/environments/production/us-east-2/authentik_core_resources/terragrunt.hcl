include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

inputs = {
  authentik_namespace       = dependency.kube_authentik.outputs.namespace
  email_templates_configmap = dependency.kube_authentik.outputs.email_templates_configmap
  media_configmap           = dependency.kube_authentik.outputs.media_configmap

  organization_name   = "Panfactum"
  organization_domain = "panfactum.com"

  logo_svg_b64 = filebase64("${get_terragrunt_dir()}/logo.svg")
  #  favicon_ico_b64 = filebase64("${get_terragrunt_dir()}/favicon.ico")

  superusers_require_webauthn = true
  default_groups_enabled      = true

  extra_groups = {
    example1   = {}
    example2   = { parent = "example1" }
    demo_users = {}
  }
}
