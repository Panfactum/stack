// Live

terraform {
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
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
  }
}

locals {
  name      = "scheduler"
  namespace = module.namespace.namespace

  labels = merge(module.scheduler.labels, {
    "panfactum.com/module" = "kube_scheduler"
  })
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

/***************************************
* Scheduler
***************************************/


resource "kubernetes_cluster_role_binding" "scheduler" {
  metadata {
    name   = "panfactum-scheduler"
    labels = local.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.scheduler.service_account_name
    namespace = local.namespace
  }
  role_ref {
    name      = "system:kube-scheduler"
    kind      = "ClusterRole"
    api_group = "rbac.authorization.k8s.io"
  }
}

resource "kubernetes_cluster_role_binding" "volume_scheduler" {
  metadata {
    name   = "panfactum-volume-scheduler"
    labels = local.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.scheduler.service_account_name
    namespace = local.namespace
  }
  role_ref {
    name      = "system:volume-scheduler"
    kind      = "ClusterRole"
    api_group = "rbac.authorization.k8s.io"
  }
}

resource "kubernetes_role_binding" "scheduler_extension" {
  metadata {
    name      = "panfactum-scheduler-extension"
    labels    = local.labels
    namespace = "kube-system"
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.scheduler.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = "extension-apiserver-authentication-reader"
  }
}

resource "kubernetes_config_map" "scheduler" {
  metadata {
    name      = "scheduler"
    namespace = local.namespace
    labels    = local.labels
  }
  data = {
    "config.yaml" = yamlencode({
      apiVersion = "kubescheduler.config.k8s.io/v1"
      kind       = "KubeSchedulerConfiguration"
      profiles = [{
        schedulerName = "panfactum"
        plugins = {
          score = {
            enabled = [
              {
                name   = "NodeResourcesFit"
                weight = 1
              }
            ]
          }
        }
        pluginConfig = [
          {
            name = "NodeResourcesFit"
            args = {
              apiVersion = "kubescheduler.config.k8s.io/v1"
              kind       = "NodeResourcesFitArgs"
              scoringStrategy = {
                resources = [
                  { name = "cpu", weight = 1 },
                  { name = "memory", weight = 1 }
                ]
                type = "MostAllocated"
              }
            }
          }
        ]
      }]
      leaderElection = {
        leaderElect = false
      }
    })
  }
}

module "scheduler" {
  source    = "../kube_deployment"
  namespace = local.namespace
  name      = local.name

  replicas                              = 1
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
  instance_type_anti_affinity_preferred = var.enhanced_ha_enabled
  topology_spread_strict                = var.enhanced_ha_enabled
  topology_spread_enabled               = var.enhanced_ha_enabled
  priority_class_name                   = "system-cluster-critical" # Scheduling will break if this breaks
  panfactum_scheduler_enabled           = false                     # Cannot schedule itself

  containers = [
    {
      name    = "scheduler"
      image   = "${module.pull_through.kubernetes_registry}/kube-scheduler"
      version = var.scheduler_version
      command = [
        "/usr/local/bin/kube-scheduler",
        "--config=/etc/kubernetes/scheduler/config.yaml",
        "-v=${var.log_verbosity}"
      ]
      minimum_memory          = 75
      memory_limit_multiplier = 2.5 # Ensure this never gets stuck in OOM and crashes cluster
    }
  ]

  config_map_mounts = {
    "${kubernetes_config_map.scheduler.metadata[0].name}" = {
      mount_path = "/etc/kubernetes/scheduler"
    }
  }

  vpa_enabled = var.vpa_enabled

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}
