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
      version = "5.39.1"
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
      version = "3.25.0"
    }
  }
}
module "namespace" {
  source = "../kube_namespace"

  namespace = "test-pg"

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name           = var.eks_cluster_name
  pg_cluster_namespace       = module.namespace.namespace
  pg_storage_gb              = 10
  pg_memory_mb               = 1000
  pg_cpu_millicores          = 250
  pg_instances               = 2
  aws_iam_ip_allow_list      = var.aws_iam_ip_allow_list
  pull_through_cache_enabled = var.pull_through_cache_enabled
  pgbouncer_pool_mode        = "transaction"

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
