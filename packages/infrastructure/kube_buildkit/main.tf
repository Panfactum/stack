terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
  }
}

locals {
  cluster_name = data.pf_metadata.metadata.kube_cluster_name

  name      = "buildkit"
  namespace = module.namespace.namespace
  arch      = toset(["amd64", "arm64"])

  port = 1234
}

data "pf_kube_labels" "labels" {
  module = "kube_buildkit"
}

data "pf_metadata" "metadata" {}

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
}

resource "kubernetes_config_map" "cache_bucket" {
  metadata {
    name      = "buildkit-cache-bucket-config"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  data = {
    bucket = module.cache_bucket.bucket_name
  }
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
  iam_policy_json           = data.aws_iam_policy_document.buildkit.json
  ip_allow_list             = var.ip_allow_list
}

/***************************************
* Buildkit StatefulSet
***************************************/

module "buildkit" {
  source   = "../kube_stateful_set"
  for_each = local.arch

  name                  = "${local.name}-${each.key}"
  namespace             = local.namespace
  pod_management_policy = "Parallel"

  # Will be autoscaled
  replicas             = 1
  ignore_replica_count = true

  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled

  # High availability is not required
  instance_type_anti_affinity_required = false
  az_spread_required                   = false
  az_spread_preferred                  = false
  host_anti_affinity_required          = false
  spot_nodes_enabled                   = var.spot_nodes_enabled

  # Ensure that we are using the appropriate CPU architectures
  arm_nodes_enabled = each.key == "arm64"
  node_requirements = {
    "kubernetes.io/arch" = [each.key]
  }

  # Gives 30 minutes for builds to finish before shutdown
  termination_grace_period_seconds = 30 * 60

  # Limit pod evictions
  unhealthy_pod_eviction_policy = "IfHealthyBudget"
  max_unavailable               = 0

  # We don't use the VPA for the builder b/c the workloads are extremely uneven
  # and we never want to disrupt the builder pods
  vpa_enabled = false

  common_env = {
    XDG_RUNTIME_DIR = "/home/user/.local/tmp"
    DOCKER_CONFIG   = "/home/user/.config/docker"
  }
  extra_pod_annotations = {
    "container.apparmor.security.beta.kubernetes.io/buildkitd" = "unconfined"
  }
  containers = [
    {
      name             = "buildkitd"
      image_registry   = "docker.io"
      image_repository = "moby/buildkit"
      image_tag        = var.buildkit_image_version
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
      liveness_probe_type    = "exec"
      liveness_probe_command = ["buildctl", "debug", "workers"]
      minimum_cpu            = var.cpu_millicores
      maximum_cpu            = var.cpu_millicores
      minimum_memory         = var.memory_mb
      ports = {
        buildkitd = {
          port = local.port
        }
      }
    }
  ]

  volume_mounts = {
    buildkitd = {
      initial_size_gb = var.initial_storage_gb
      storage_class   = "ebs-standard"
      access_modes    = ["ReadWriteOnce"]
      increase_gb     = 25
      mount_path      = "/home/user/.local/share/buildkit"
      backups_enabled = false
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
}

resource "kubernetes_role" "buildkit_user" {
  metadata {
    name      = "buildkit-user"
    namespace = local.namespace
    labels    = data.pf_kube_labels.labels.labels
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
* This CronJob will periodically attempt to scale
* the BuildKit StatefulSet to 0 if there are no
* recent builds
***************************************/

resource "kubernetes_role_binding" "scale_to_zero" {
  metadata {
    name      = "scale-to-zero"
    namespace = local.namespace
    labels    = module.scale_to_zero.labels
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
  spot_nodes_enabled          = var.spot_nodes_enabled
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = "*/15 * * * *"
  containers = [{
    name             = "scale-to-zero"
    image_registry   = "public.ecr.aws"
    image_repository = module.constants.panfactum_image_repository
    image_tag        = module.constants.panfactum_image_tag
    command = [
      "/bin/pf-buildkit-scale-down",
      "--timeout",
      tostring(var.scale_down_delay_seconds)
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5
}

/***************************************
* Buildkit Cache Clear
*
* This CronJob will periodically reset the build cache
* to remove cache items that are no longer in use
***************************************/

resource "kubernetes_role" "cache_clear" {
  metadata {
    name      = "cache-clear"
    namespace = local.namespace
    labels    = module.cache_clear.labels
  }
  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["get", "list"]
  }
  rule {
    api_groups = [""]
    resources  = ["pods/exec"]
    verbs      = ["create"]
  }
  rule {
    api_groups = [""]
    resources  = ["persistentvolumeclaims"]
    verbs      = ["get", "list", "delete"]
  }
}

resource "kubernetes_role_binding" "cache_clear" {
  metadata {
    name      = "cache-clear"
    namespace = local.namespace
    labels    = module.cache_clear.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = module.cache_clear.service_account_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.cache_clear.metadata[0].name
  }
}

module "cache_clear" {
  source = "../kube_cron_job"

  name                        = "cache-clear"
  namespace                   = local.namespace
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  spot_nodes_enabled          = var.spot_nodes_enabled
  arm_nodes_enabled           = true
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  vpa_enabled                 = var.vpa_enabled

  cron_schedule = var.cache_clear_cron
  containers = [{
    name             = "cache-clear"
    image_registry   = "public.ecr.aws"
    image_repository = module.constants.panfactum_image_repository
    image_tag        = module.constants.panfactum_image_tag
    command = [
      "/bin/pf-buildkit-clear-cache",
    ]
    minimum_memory = 50
  }]
  starting_deadline_seconds = 60 * 5
  active_deadline_seconds   = 60 * 5
}
