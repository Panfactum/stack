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

dependency "ingress_nginx" {
  config_path  = "../kube_ingress_nginx"
  skip_outputs = true
}

dependency "vault" {
  config_path = "../kube_vault"
}

inputs = {
  ingress_domains = ["temporal.prod.panfactum.com"]
  vault_domain    = dependency.vault.outputs.vault_domain
}
