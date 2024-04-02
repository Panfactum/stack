include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//kube_ingress_nginx"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_ingress_nginx"
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
  ingress_domains = [
    "panfactum.com",
    "production.panfactum.com",
    "prod.panfactum.com"
  ]
  dhparam                 = local.secrets.dhparam
  ingress_timeout_seconds = 60
  tls_1_2_enabled         = false

  pull_through_cache_enabled = true
  vpa_enabled                = true
}


