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
  }
}

locals {
  name      = "vertical-pod-autoscaler"
  namespace = module.namespace.namespace
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "kube_labels" {
  source = "../kube_labels"

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "constants_admission_controller" {
  source = "../constants"

  matching_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "admission-controller"
  }

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "constants_updater" {
  source = "../constants"

  matching_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "updater"
  }

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

module "constants_recommender" {
  source = "../constants"

  matching_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "recommender"
  }

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

# ################################################################################
# Namespace
# ################################################################################

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

# ################################################################################
# Vertical Autoscaler
# ################################################################################

module "webhook_cert" {
  source = "../kube_internal_cert"

  service_names = ["vpa-webhook"]
  secret_name   = "vpa-webhook-certs"
  namespace     = local.namespace

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

resource "helm_release" "vpa" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://charts.fairwinds.com/stable"
  chart           = "vpa"
  version         = var.vertical_autoscaler_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = "vpa"

      podLabels = merge(module.kube_labels.kube_labels, {
        customizationHash = md5(join("", [for filename in fileset(path.module, "vpa_kustomize/*") : filesha256(filename)]))
      })

      priorityClassName = "system-cluster-critical"

      recommender = {

        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/autoscaling/vpa-recommender"
        }

        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }

        // ONLY 1 of these should be running at a time
        // b/c there is no leader-election: https://github.com/kubernetes/autoscaler/issues/5481
        // However, that creates a potential issue with memory consumption as if this pod
        // OOMs, then it won't be recorded and then bumped up. As a result, we have to tune this
        // pods memory floor carefully and give it plenty of headroom.
        replicaCount = 1
        affinity     = module.constants_recommender.controller_node_with_burstable_affinity_helm
        tolerations  = module.constants_recommender.burstable_node_toleration_helm

        extraArgs = {
          // Better packing
          "pod-recommendation-min-cpu-millicores" = 2
          "pod-recommendation-min-memory-mb"      = 10

          // Lower half-life so we have better intra-day scaling
          "cpu-histogram-decay-half-life"    = "2h0m0s"
          "memory-histogram-decay-half-life" = "2h0m0s"

          // Provide 30% headroom (instead of the 15% default)
          "recommendation-margin-fraction" = 0.3

          v = var.log_verbosity
        }

        resources = {
          requests = {
            memory = "300Mi"
          }
          limits = {
            memory = "500Mi"
          }
        }
      }


      updater = {

        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/autoscaling/vpa-updater"
        }

        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }

        // ONLY 1 of these should be running at a time
        // b/c there is no leader-election: https://github.com/kubernetes/autoscaler/issues/5481
        replicaCount = 1
        affinity     = module.constants_updater.controller_node_with_burstable_affinity_helm
        tolerations  = module.constants_updater.burstable_node_toleration_helm

        extraArgs = {
          "min-replicas" = 0 // We don't care b/c we use pdbs
          v              = var.log_verbosity
        }

        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }
      }

      admissionController = {

        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/autoscaling/vpa-admission-controller"
        }

        annotations = {
          "reloader.stakater.com/auto" = "true"
        }
        podAnnotations = {
          "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
        }

        // We do need at least 2 otherwise we may get stuck in a loop
        // b/c if this pod goes down, it cannot apply the appropriate
        // resource requirements when it comes back up and then the
        // updater will take it down again
        replicaCount = 2
        affinity = merge(
          module.constants_admission_controller.controller_node_with_burstable_affinity_helm,
          module.constants_admission_controller.pod_anti_affinity_helm
        )
        tolerations = module.constants_admission_controller.burstable_node_toleration_helm

        podDisruptionBudget = {
          minAvailable = 1
        }

        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }

        // We will use our own secret
        generateCertificate = false
        secretName          = module.webhook_cert.secret_name
        extraArgs = {
          client-ca-file  = "/etc/tls-certs/ca.crt"
          tls-cert-file   = "/etc/tls-certs/tls.crt"
          tls-private-key = "/etc/tls-certs/tls.key"
          v               = var.log_verbosity
        }
        mutatingWebhookConfiguration = {
          annotations = {
            "cert-manager.io/inject-ca-from" = "${local.namespace}/${module.webhook_cert.certificate_name}"
          }
        }
      }
    })
  ]
}

/***************************************
* VPA Resources
***************************************/

resource "kubernetes_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vpa-admission-controller"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vpa-admission-controller"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_recommender" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vpa-recommender"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "vpa"
          minAllowed = {
            memory = "100Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vpa-recommender"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_updater" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vpa-updater"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vpa-updater"
      }
    }
  }
}
