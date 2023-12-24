terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
  }
}

locals {
  labels = merge(var.kube_labels, {
    service = var.name
  })
}

module "pod_template" {
  source       = "../kube_pod"
  allowed_spot = true
  is_local     = var.is_local

  namespace           = var.namespace
  service_account     = var.service_account
  priority_class_name = var.priority_class_name
  kube_labels         = var.kube_labels
  pod_annotations     = var.pod_annotations

  containers = var.containers

  secret_mounts   = var.secret_mounts
  secrets         = var.secrets
  common_env      = var.common_env
  dynamic_secrets = var.dynamic_secrets

  tmp_directories = var.tmp_directories
  mount_owner     = var.mount_owner

  node_preferences  = var.node_preferences
  node_requirements = var.node_requirements
  tolerations       = var.tolerations
  restart_policy    = var.restart_policy
}

resource "kubernetes_manifest" "cronjob" {
  manifest = {
    apiVersion = "batch/v1"
    kind       = "CronJob"
    metadata = {
      namespace = var.namespace
      name      = var.name
      labels    = local.labels
    }
    spec = {
      concurrencyPolicy          = var.concurrency_policy
      failedJobsHistoryLimit     = 1
      schedule                   = var.schedule
      startingDeadlineSeconds    = 120 // give enough time for a new node to spin up
      successfulJobsHistoryLimit = 1
      timeZone                   = "UTC"
      jobTemplate = {
        metadata = {
          labels = local.labels
        }
        spec = {
          activeDeadlineSeconds   = var.timeout_seconds
          ttlSecondsAfterFinished = 60 * 5
          template                = module.pod_template.pod_template
        }
      }
    }
  }
  computed_fields = flatten(concat(

    // The defaults used by the provider
    [
      "metadata.labels",
      "metadata.annotations"
    ],

    // The prevents an error when the kubernetes API server changes the units used
    // in these fields during the apply
    [for i, k in keys(module.pod_template.containers) : [
      "spec.jobTemplate.spec.template.spec.containers[${i}].resources.requests",
      "spec.jobTemplate.spec.template.spec.containers[${i}].resources.limits",
    ]],
    [for i, k in keys(module.pod_template.init_containers) : [
      "spec.jobTemplate.spec.template.spec.initContainers[${i}].resources.requests",
      "spec.jobTemplate.spec.template.spec.initContainers[${i}].resources.limits",
    ]],

    // Runs into an issue when using empty lists
    [for i, k in keys(module.pod_template.containers) : [
      "spec.jobTemplate.spec.template.spec.containers[${i}].securityContext.capabilities",
    ]],
    [for i, k in keys(module.pod_template.init_containers) : [
      "spec.jobTemplate.spec.template.spec.initContainers[${i}].securityContext.capabilities",
    ]],
    [
      "spec.jobTemplate.spec.template.spec.affinity.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution",
      "spec.jobTemplate.spec.template.spec.affinity.podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution"
    ]
  ))

  field_manager {
    force_conflicts = true
  }
}

resource "kubernetes_manifest" "vpa_server" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = var.name
      namespace = var.namespace
      labels    = local.labels
    }
    spec = {
      targetRef = {
        apiVersion = "batch/v1"
        kind       = "CronJob"
        name       = var.name
      }
      updatePolicy = {
        updateMode = "Auto"
      }
      resourcePolicy = {
        containerPolicies = [for config in var.containers : {
          containerName = config.name
          minAllowed = {
            memory = "${config.minimum_memory}Mi"
            cpu    = "${config.minimum_cpu}m"
          }
        }]
      }
    }
  }
  depends_on = [kubernetes_manifest.cronjob]
}

// Don't allow disruptions of cronjobs
resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${var.name}-pdb"
      namespace = var.namespace
      labels    = local.labels
    }
    spec = {
      selector = {
        matchLabels = module.pod_template.match_labels
      }
      maxUnavailable             = 0
      unhealthyPodEvictionPolicy = "AlwaysAllow"
    }
  }
}

