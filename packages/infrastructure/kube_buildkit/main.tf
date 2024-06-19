// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {

  name      = "buildkit"
  namespace = module.namespace.namespace

  match_labels = {
    service        = local.name
    pf_root_module = var.pf_root_module
  }

  port = 1234

}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***************************************
* S3 Caching Bucket
***************************************/

resource "random_id" "cache_bucket" {
  byte_length = 8
  prefix      = "buildkit-cache-"
}

module "cache_bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name        = random_id.cache_bucket.hex
  description        = "Used for buildkit layer caches"
  expire_after_days  = 7
  versioning_enabled = false
  force_destroy      = true

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***************************************
* AWS Permissions
***************************************/
data "aws_iam_policy_document" "buildkit" {

  // Allowed to control caching bucket
  statement {
    effect  = "Allow"
    actions = ["s3:*"]
    resources = [
      module.cache_bucket.bucket_arn,
      "${module.cache_bucket.bucket_arn}/*"
    ]
  }
}

module "aws_permissions" {
  source = "../kube_sa_auth_aws"

  service_account           = module.buildkit.service_account_name
  service_account_namespace = local.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.buildkit.json
  ip_allow_list             = var.ip_allow_list

  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***************************************
* Buildkit StatefulSet
***************************************/

module "buildkit" {
  source = "../kube_stateful_set"

  name                             = "buildkit"
  namespace                        = local.namespace
  pod_management_policy            = "Parallel"
  replicas                         = 1
  ignore_replica_count             = true
  termination_grace_period_seconds = 30 * 60

  # We don't use the VPA for the builder b/c the workloads are extremely uneven
  # and we never want to disrupt the builder pods
  vpa_enabled     = false
  max_unavailable = 1

  containers = [
    {
      name    = local.name
      image   = "${var.pull_through_cache_enabled ? module.pull_through[0].docker_hub_registry : "docker.io"}/moby/buildkit"
      version = "v0.12.2"
      command = [
        "buildkitd",
        "--addr", "tcp://0.0.0.0:${local.port}",
        "--addr", "unix:///run/buildkit/buildkitd.sock"
      ]
      privileged             = true
      run_as_root            = true
      liveness_check_type    = "exec"
      liveness_check_command = ["buildctl", "debug", "workers"]
      minimum_cpu            = var.cpu_millicores
      maximum_cpu            = var.cpu_millicores
      minimum_memory         = var.memory_mb
    }
  ]

  volume_mounts = {
    buildkitd = {
      initial_size_gb    = var.local_storage_gb
      storage_class_name = "ebs-standard"
      access_modes       = ["ReadWriteOnce"]
      increase_gb        = 25
      mount_path         = "/var/lib/buildkit"
    }
  }

  tmp_directories = {
    "run" = {
      mount_path = "/run/buildkit"
      size_mb    = 10
      node_local = true
    }
  }

  volume_retention_policy = {
    when_deleted = "Delete"
  }


  ports = {
    buildkitd = {
      service_port = 1234
      pod_port     = 1234
    }
  }

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

resource "kubernetes_horizontal_pod_autoscaler_v2" "autoscaler" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.buildkit.labels
  }
  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "StatefulSet"
      name        = local.name
    }
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas
    metric {
      type = "ContainerResource"
      container_resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
        container = "buildkitd"
      }
    }
    metric {
      type = "ContainerResource"
      container_resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
        container = "buildkitd"
      }
    }
    behavior {
      scale_down {
        select_policy                = "Max"
        stabilization_window_seconds = 300

        policy {
          period_seconds = 60
          type           = "Pods"
          value          = 1
        }
      }

      scale_up {
        select_policy                = "Max"
        stabilization_window_seconds = 60

        policy {
          period_seconds = 15
          type           = "Pods"
          value          = 1
        }
      }
    }
  }
  depends_on = [module.buildkit]
}

/***************************************
* Buildkit Scale-To-Zero
*
* This workflow will periodically attempt to scale
* the BuildKit StatefulSet to 0 if there are no
* recent builds
***************************************/

module "util_scale_to_zero" {
  source = "../kube_workload_utility"

  workload_name                        = "buildkit-scale-to-zero"
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

resource "kubernetes_service_account" "scale_to_zero" {
  metadata {
    name      = "scale-to-zero"
    namespace = local.namespace
    labels    = module.util_scale_to_zero.labels
  }
}

resource "kubernetes_role" "scale_to_zero" {
  metadata {
    name      = "scale-to-zero"
    namespace = local.namespace
    labels    = module.util_scale_to_zero.labels
  }
  rule {
    api_groups = ["apps"]
    resources  = ["statefulsets", "statefulsets/scale"]
    verbs      = ["get", "list", "patch"]
  }
}

resource "kubernetes_role_binding" "scale_to_zero" {
  metadata {
    name      = "scale-to-zero"
    namespace = local.namespace
    labels    = module.util_scale_to_zero.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.scale_to_zero.metadata[0].name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.scale_to_zero.metadata[0].name
  }
}

module "workflow_perms" {
  source                    = "../kube_sa_auth_workflow"
  service_account           = kubernetes_service_account.scale_to_zero.metadata[0].name
  service_account_namespace = local.namespace
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
      name      = "buildkit-scale-to-zero"
      namespace = local.namespace
      labels    = module.util_scale_to_zero.labels
    }
    spec = {
      schedule          = "*/15 * * * *"
      concurrencyPolicy = "Forbid"
      workflowMetadata = {
        labels = module.util_scale_to_zero.labels
      }
      workflowSpec = {
        serviceAccountName = kubernetes_service_account.scale_to_zero.metadata[0].name

        affinity      = module.util_scale_to_zero.affinity
        schedulerName = module.util_scale_to_zero.scheduler_name
        tolerations   = module.util_scale_to_zero.tolerations
        podDisruptionBudget = {
          maxUnavailable = 0
        }
        podMetadata = {
          labels = module.util_scale_to_zero.labels
        }

        entrypoint = "scale-to-zero"
        templates = [
          {
            name = "scale-to-zero"
            container = {
              image = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/panfactum/panfactum:alpha.3"
              command = [
                "/bin/scale-buildkit",
                "--attempt-scale-down",
                tostring(var.scale_down_delay_seconds)
              ]
            }
          }
        ]
      }
    }
  })

  force_conflicts   = true
  server_side_apply = true

  depends_on = [module.buildkit]
}