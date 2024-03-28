include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_external_dnss"
}

dependency "aws_eks" {
  config_path = "../aws_eks"
}

dependency "cert_issuers" {
  config_path = "../kube_cert_issuers"
}

inputs = {
  eks_cluster_name = dependency.aws_eks.outputs.cluster_name
  route53_zones    = dependency.cert_issuers.outputs.route53_zones

  pull_through_cache_enabled = true
  vpa_enabled                = true
}


