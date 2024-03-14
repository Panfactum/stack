include "panfactum" {
  path = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_priority_classes"
}

dependency "cluster" {
  config_path = "../aws_eks"
  skip_outputs = true
}

inputs = {}
