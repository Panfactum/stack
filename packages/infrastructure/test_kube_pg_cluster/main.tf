terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}
module "namespace" {
  source = "../kube_namespace"

  namespace = "test-pg"
}

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name                     = var.eks_cluster_name
  pg_cluster_namespace                 = module.namespace.namespace
  pg_initial_storage_gb                = 10
  pg_instances                         = 2
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false
  burstable_nodes_enabled              = true
  pgbouncer_pool_mode                  = "transaction"
}
