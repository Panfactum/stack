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

inputs = {
  eks_cluster_name = dependency.cluster.outputs.cluster_name

  ingress_enabled = true
  vault_domain    = "vault.prod.panfactum.com"

  # Backwards Compatibility: Do not use
  vault_storage_size_gb = 20
}
