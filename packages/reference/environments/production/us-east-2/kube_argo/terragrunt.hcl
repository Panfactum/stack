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

  argo_domain  = "argo.prod.panfactum.com"
  vault_domain = dependency.vault.outputs.vault_domain

  test_workflow_enabled = true
}