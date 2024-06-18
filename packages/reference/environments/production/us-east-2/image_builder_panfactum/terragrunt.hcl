include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

dependency "aws_eks" {
  config_path = "../aws_eks"
}

inputs = {
  namespace        = "kube-system"
  eks_cluster_name = dependency.aws_eks.outputs.cluster_name
}



