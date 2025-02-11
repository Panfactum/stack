include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "cluster" {
  config_path = "../aws_eks"
}

dependency "vault" {
  config_path = "../kube_vault"
}

inputs = {
  vault_internal_url = dependency.vault.outputs.vault_internal_url
  kubernetes_url     = dependency.cluster.outputs.cluster_url
}