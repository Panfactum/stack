toterraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.70.0"
      configuration_aliases = [aws.global]
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  name      = "authentik"
  namespace = module.namespace.namespace
}

module "namespace" {
  source = "${var.pf_module_source}kube_namespace${var.pf_module_ref}"

  namespace = var.namespace
}

module "database" {
  source = "../kube_pg_cluster"

  eks_cluster_name                     = var.eks_cluster_name
  pg_cluster_namespace                 = local.namespace
  pg_initial_storage_gb                = 10
  pg_memory_mb                         = 1000
  pg_cpu_millicores                    = 250
  pg_instances                         = 2
  pg_smart_shutdown_timeout            = 1
  aws_iam_ip_allow_list                = var.aws_iam_ip_allow_list
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  pgbouncer_pool_mode                  = "transaction" // See https://github.com/goauthentik/authentik/issues/9152
  burstable_nodes_enabled              = true
  monitoring_enabled                   = var.monitoring_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_required = var.enhanced_ha_enabled

  pg_recovery_mode_enabled = var.db_recovery_mode_enabled
  pg_recovery_directory    = var.db_recovery_directory
  pg_recovery_target_time  = var.db_recovery_target_time
}