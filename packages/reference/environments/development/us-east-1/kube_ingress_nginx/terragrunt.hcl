include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cert_issuers" {
  config_path  = "../kube_cert_issuers"
  skip_outputs = true
}

dependency "lb_controller" {
  config_path  = "../kube_aws_lb_controller"
  skip_outputs = true
}

locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  ingress_domains = [
    "seth.panfactum.com"
  ]
  dhparam                 = local.secrets.dhparam
  ingress_timeout_seconds = 60

  // Tune this as appropriate for your use case: https://panfactum.com/docs/edge/guides/deploying-workloads/high-availability
  sla_level = 1
}