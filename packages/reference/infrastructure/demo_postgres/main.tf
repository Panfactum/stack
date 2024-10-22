terraform {
  required_providers {
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  name      = "demo-postgres"
  namespace = module.namespace.namespace
}

module "namespace" {
  source = "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = var.namespace
}

module "database" {
  source = "${var.pf_module_source}kube_pg_cluster${var.pf_module_ref}"

  eks_cluster_name                     = var.eks_cluster_name
  pg_cluster_namespace                 = local.namespace
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list

  pg_initial_storage_gb                = var.pg_initial_storage_gb
  pg_max_connections                   = var.pg_max_connections # for the purposes of the demo
  pg_instances                         = var.pg_instances # for the purposes of the demo
  burstable_nodes_enabled              = var.burstable_nodes_enabled # for the purposes of the demo

  pull_through_cache_enabled           = var.pull_through_cache_enabled
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
}