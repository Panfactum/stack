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
  eks_cluster_name = dependency.cluster.outputs.cluster_name

  grafana_domain = "grafana.prod.panfactum.com"
  vault_domain   = dependency.vault.outputs.vault_domain

  ingress_enabled = true
}
