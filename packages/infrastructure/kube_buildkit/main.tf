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
  arch      = toset(["amd64", "arm64"])

  port = 1234

  workflow_labels = merge(
    module.scale_to_zero.labels,
    { "panfactum.com/module" = "kube_buildkit" }
  )
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "constants" {
  source = "../kube_constants"
}

data "aws_region" "region" {}
data "aws_caller_identity" "current" {}

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
  for_each = local.arch
  source   = "../kube_sa_auth_aws"

  service_account           = module.buildkit[each.key].service_account_name
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
  source   = "../kube_stateful_set"
  for_each = local.arch

  name                        = "${local.name}-${each.key}"
  namespace                   = local.namespace
  pod_management_policy       = "Parallel"
  replicas                    = 1
  ignore_replica_count        = true
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  arm_nodes_enabled           = each.key == "arm64"
  node_requirements = {
    "kubernetes.io/arch" = [each.key]
  }
  spot_nodes_enabled               = true
  termination_grace_period_seconds = 30 * 60

  # We don't use the VPA for the builder b/c the workloads are extremely uneven
  # and we never want to disrupt the builder pods
  vpa_enabled     = false
  max_unavailable = 0

  common_env = {
    XDG_RUNTIME_DIR = "/home/user/.local/tmp"
    DOCKER_CONFIG   = "/home/user/.config/docker"
  }
  pod_annotations = {
    "container.apparmor.security.beta.kubernetes.io/buildkitd" = "unconfined"
  }
  containers = [
    {
      name    = "buildkitd"
      image   = "${module.pull_through.docker_hub_registry}/moby/buildkit"
      version = var.buildkit_image_version
      command = [
        "rootlesskit",
        "buildkitd",
        "--addr", "tcp://0.0.0.0:${local.port}",
        "--addr", "unix:///run/user/1000/buildkit/buildkitd.sock",
        "--oci-worker-no-process-sandbox",
        # GC is enabled by default so we need to increase the limits in order to keep a meaningful cache
        "--oci-worker-gc-keepstorage", tostring(var.max_storage_gb * 1000)
      ]
      uid = 1000
      linux_capabilities = [
        "SYS_ADMIN",
        "SETUID",
        "SETGID"
      ]
      liveness_check_type    = "exec"
      liveness_check_command = ["buildctl", "debug", "workers"]
      minimum_cpu            = var.cpu_millicores
      maximum_cpu            = var.cpu_millicores
      minimum_memory         = var.memory_mb
    }
  ]

  volume_mounts = {
    buildkitd = {
      initial_size_gb    = var.initial_storage_gb
      storage_class_name = "ebs-standard"
      access_modes       = ["ReadWriteOnce"]
      increase_gb        = 25
      mount_path         = "/home/user/.local/share/buildkit"
    }
  }

  tmp_directories = {
    "tmp" = {
      mount_path = "/home/user/.local/tmp"
      size_mb    = 100
      node_local = true
    }
    "root-tmp" = {
      mount_path = "/tmp"
      size_mb    = 10
      node_local = true
    }
    "run" = {
      mount_path = "/run/user/1000/buildkit"
      size_mb    = 10
      node_local = true
    }
    "config" = {
      mount_path = "/home/user/.config"
      size_mb    = 10
      node_local = true
    }
  }

  volume_retention_policy = {
    when_deleted = "Delete"
  }

  ports = {
    buildkitd = {
      service_port = local.port
      pod_port     = local.port
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

resource "kubernetes_role" "buildkit_user" {
  metadata {
    name      = "buildkit-user"
    namespace = local.namespace
  }
  rule {
    api_groups     = ["apps"]
    resources      = ["statefulsets", "statefulsets/scale"]
    verbs          = ["get", "list", "patch"]
    resource_names = [for arch in local.arch : "${local.name}-${arch}"]
  }
  rule {
    api_groups = ["", "metrics.k8s.io"]
    resources  = ["pods"]
    verbs      = ["get", "list"]
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "autoscaler" {
  for_each = local.arch
  metadata {
    name      = "${local.name}-${each.key}"
    namespace = local.namespace
    labels    = module.buildkit[each.key].labels
  }
  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "StatefulSet"
      name        = "${local.name}-${each.key}"
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

resource "kubernetes_role_binding" "scale_to_zero" {
  metadata {
    name      = "scale-to-zero"
    namespace = local.namespace
    labels    = local.workflow_labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.scale_to_zero.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.buildkit_user.metadata[0].name
  }
}

module "scale_to_zero" {
  source = "../kube_cron_job"

  name                        = "scale-to-zero"
  namespace                   = local.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  spot_nodes_enabled          = true
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true

  cron_schedule = "*/15 * * * *"
  containers = [{
    name    = "scale-to-zero"
    image   = "${module.pull_through.ecr_public_registry}/${module.constants.panfactum_image}"
    version = module.constants.panfactum_image_version
    command = [
      "/bin/pf-buildkit-scale-down",
      "--timeout",
      tostring(var.scale_down_delay_seconds)
    ]
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5

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
