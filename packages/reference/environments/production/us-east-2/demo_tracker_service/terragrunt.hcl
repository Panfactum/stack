include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

dependency "ingress" {
  config_path  = "../kube_ingress_nginx"
  skip_outputs = true
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  eks_cluster_name       = dependency.cluster.outputs.cluster_name
  namespace = "demo-tracker-service"

  domain        = "demo.panfactum.com"
  image_version = "testing4"
  healthcheck_route = "/health"
  db_name = "postgres"
  db_schema = "app"
  secret = "secret"
}