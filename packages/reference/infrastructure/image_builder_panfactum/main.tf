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
  }
}

data "aws_region" "current" {}

locals {
  name = "panfactum-image-builder"
}

module "pull_through" {
  source =   "github.com/Panfactum/stack.git//packages/infrastructure/aws_ecr_pull_through_cache_addresses?ref=496c4c1cb94435765546d25fc65c9d4ec751b949" # pf-update
}

module "util" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/kube_workload_utility?ref=496c4c1cb94435765546d25fc65c9d4ec751b949" # pf-update

  workload_name                        = local.name
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = false
  panfactum_scheduler_enabled          = true
  instance_type_anti_affinity_required = false
  topology_spread_strict               = false
  topology_spread_enabled              = false
  lifetime_evictions_enabled           = false

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}

resource "kubernetes_service_account" "sa" {
  metadata {
    name      = local.name
    namespace = var.namespace
  }
}

module "workflow_perms" {
  source                    = "github.com/Panfactum/stack.git//packages/infrastructure/kube_sa_auth_workflow?ref=496c4c1cb94435765546d25fc65c9d4ec751b949" #pf-update

  service_account           = kubernetes_service_account.sa.metadata[0].name
  service_account_namespace = var.namespace
  eks_cluster_name          = var.eks_cluster_name

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

resource "kubectl_manifest" "scale_to_zero" {
  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "CronWorkflow"
    metadata = {
      name      = local.name
      namespace = var.namespace
      labels    = module.util.labels
    }
    spec = {
      schedule          = "*/15 * * * *"
      concurrencyPolicy = "Forbid"
      workflowMetadata = {
        labels = module.util.labels
      }
      workflowSpec = {
        serviceAccountName = kubernetes_service_account.sa.metadata[0].name

        affinity      = module.util.affinity
        schedulerName = module.util.scheduler_name
        tolerations   = module.util.tolerations
        podDisruptionBudget = {
          maxUnavailable = 0
        }
        podMetadata = {
          labels = module.util.labels
        }

        entrypoint = "scale-to-zero"
        templates = [
          {
            name = "scale-to-zero"
            container = {
              image = "${module.pull_through.github_registry}/panfactum/panfactum:alpha.3"
              command = [
                "/bin/scale-buildkit",
                "--attempt-scale-down",
                "300"
              ]
            }
          }
        ]
      }
    }
  })

  force_conflicts   = true
  server_side_apply = true
}

