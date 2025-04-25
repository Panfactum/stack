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

dependency "cert_issuers" {
  config_path  = "../kube_cert_issuers"
  skip_outputs = true
}

dependency "lb_controller" {
  config_path  = "../kube_aws_lb_controller"
  skip_outputs = true
}

inputs = {
  dhparam                 = local.secrets.dhparam
  ingress_timeout_seconds = 60
}


