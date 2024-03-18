include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "../../../../../terraform//kube_cilium"
  #source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_priority_classes"
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  eks_cluster_name = dependency.cluster.outputs.cluster_name
  eks_cluster_url = dependency.cluster.outputs.cluster_url
}
