include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_rbac"
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  aws_node_role_arn         = dependency.cluster.outputs.node_role_arn
}
