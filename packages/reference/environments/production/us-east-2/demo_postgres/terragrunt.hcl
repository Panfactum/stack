include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source # marking for demo purposes and mention in guide
}

dependency "cnpg" {
  config_path  = "../kube_cloudnative_pg"
  skip_outputs = true
}

dependency "cluster" {
  config_path = "../aws_eks"
}

inputs = {
  namespace = "demo-postgres"
  eks_cluster_name = dependency.cluster.outputs.cluster_name

  # for the purposes of the demo
  pg_initial_storage_gb = 5
  pg_max_connections = 20
  pg_instances = 2
  burstable_nodes_enabled = true
}
