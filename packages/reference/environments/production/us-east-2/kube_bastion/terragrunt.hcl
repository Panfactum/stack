include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_bastion"
}

dependency "vault_config" {
  config_path  = "../vault_core_resources"
  skip_outputs = true
}

dependency "lb_controller" {
  config_path  = "../kube_aws_lb_controller"
  skip_outputs = true
}

inputs = {
  bastion_domains = [
    "bastion.panfactum.com",
    "bastion.production.panfactum.com",
    "bastion.prod.panfactum.com"
  ]
  ssh_cert_lifetime_seconds  = 60 * 60 * 8
  pull_through_cache_enabled = true
  vpa_enabled                = true
}


