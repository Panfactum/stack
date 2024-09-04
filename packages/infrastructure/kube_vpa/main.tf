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

  kustomization_labels = {
    customizationHash = md5(join("", [
      for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
    ]))
  }
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util_admission_controller" {
  source                        = "../kube_workload_utility"
  workload_name                 = "vpa-admission-controller"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled
  match_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "admission-controller"
  }

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

module "util_recommender" {
  source                        = "../kube_workload_utility"
  workload_name                 = "vpa-recommender"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled
  match_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "recommender"
  }
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

module "util_updater" {
  source                        = "../kube_workload_utility"
  workload_name                 = "vpa-updater"
  burstable_nodes_enabled       = true
  controller_nodes_enabled      = true
  panfactum_scheduler_enabled   = var.panfactum_scheduler_enabled
  instance_type_spread_required = var.enhanced_ha_enabled
  az_spread_preferred           = var.enhanced_ha_enabled
  match_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "updater"
  }

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

module "constants" {
  source = "../kube_constants"
}

# ################################################################################
# Namespace
# ################################################################################

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

# ################################################################################
# Vertical Autoscaler
# ################################################################################

module "webhook_cert" {
  source = "../kube_internal_cert"

  service_names = ["vpa-webhook"]
  secret_name   = "vpa-webhook-certs"
  namespace     = local.namespace

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
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "vpa"

      priorityClassName = "system-cluster-critical"

      recommender = {

        podLabels = merge(
          # We must filter out the labels added by the helm chart b/c this will cause a duplicate label issue in kustomize
          { for k, v in module.util_recommender.labels : k => v if k != "app.kubernetes.io/name" && k != "app.kubernetes.io/component" },
          local.kustomization_labels
        )

        image = {
          repository = "${module.pull_through.kubernetes_registry}/autoscaling/vpa-recommender"
          tag        = var.vertical_autoscaler_image_version
        }

        // ONLY 1 of these should be running at a time
        // b/c there is no leader-election: https://github.com/kubernetes/autoscaler/issues/5481
        // However, that creates a potential issue with memory consumption as if this pod
        // OOMs, then it won't be recorded and then bumped up. As a result, we have to tune this
        // pods memory floor carefully and give it plenty of headroom.
        replicaCount = 1
        affinity     = module.util_recommender.affinity
        tolerations  = module.util_recommender.tolerations

        metrics = {
          serviceMonitor = {
            enabled   = var.monitoring_enabled
            namespace = local.namespace
            interval  = "60s"
            timeout   = "10s"
          }
        }

        extraArgs = merge({
          // Better packing
          "pod-recommendation-min-cpu-millicores" = 2
          "pod-recommendation-min-memory-mb"      = 10

          // After 8 halvings, the metrics will essentially be ignored
          "cpu-histogram-decay-half-life"    = "${max(1, floor(var.history_length_hours / 8))}h0m0s"
          "memory-histogram-decay-half-life" = "${max(1, floor(var.history_length_hours / 8))}h0m0s"

          // Provide additional headroom over the base recommendation calculation
          "recommendation-margin-fraction" = 0.15

          v = var.log_verbosity
          }, var.prometheus_enabled ? {
          // When prometheus is enabled, the initial recommendations will be
          // provided by prometheus queries instead of the VPACheckpoint objects
          //
          // CPU: rate(container_cpu_usage_seconds_total{job="kubelet", pod=~".+", container!="POD", container!=""}[<history-resolution>])
          // MEMORY: container_memory_working_set_bytes{job="kubelet", pod=~".+", container!="POD", container!=""}
          //
          // Those queries will look back <history-length> time at <history-resolution> steps in order to provide
          // initial data for the internal histogram buckets.
          //
          // In order to match the metrics with actual VPA resources, pod labels are used which are provided
          // by kube-state-metrics via kube_pod_labels{}[<history-length>. This must go back all the way to the <history-length> (lots of data!)
          // Pods not found in kube_pod_labels{} will be dropped from the assessments.
          //
          // After loading this initial metrics, the recommender will no longer query prometheus and instead
          // rely on live monitoring of the kubernetes API for updating its internal recommendations
          //
          // Using Prometheus has the following weaknesses:
          // - Prometheus and kube-state-metrics need to be running for at least <history-length> in order for the VPA
          // to provide accurate recommendations. BEWARE: Ignoring this recommendation will likely cause some of your
          // VPAs to not work at all due to the way that the recommender drops AggregateCollectionStates for VPA targets
          // that have no historical data. This will likely cause a cascading failure in your system!!!
          //
          // - Because prometheus focused on pods, time periods with more pods (high churn / more replicas) will have
          // more samples added to the histogram bucket and thus be weighted more heavily
          //
          // - As this only runs at recommender startup, this will cause a significant resource burst (on both prometheus and the recommender),
          // which may cause system components to crash if not planned for in advance. As a result, <history-length> should be kept reasonable.
          //
          // - OOMs are not tracked in the metrics history so will essentially be forgotten every time the recommender restarts
          prometheus-address           = var.thanos_query_frontend_url
          storage                      = "prometheus"
          prometheus-cadvisor-job-name = "kubelet"
          container-pod-name-label     = "pod"
          container-name-label         = "container"
          container-namespace-label    = "namespace"
          pod-namespace-label          = "namespace"
          pod-name-label               = "pod"
          metric-for-pod-labels        = "kube_pod_labels{}[${var.history_length_hours}h]" #
          pod-label-prefix             = "label_"
          history-length               = "${var.history_length_hours}h"
          history-resolution           = "${max(floor(var.history_length_hours * 60 / 100), 1)}m" # Gets the last 100 samples
        } : {})

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

        podLabels = merge(
          # We must filter out the labels added by the helm chart b/c this will cause a duplicate label issue in kustomize
          { for k, v in module.util_updater.labels : k => v if k != "app.kubernetes.io/name" && k != "app.kubernetes.io/component" },
          local.kustomization_labels
        )

        image = {
          repository = "${module.pull_through.kubernetes_registry}/autoscaling/vpa-updater"
          tag        = var.vertical_autoscaler_image_version
        }

        // ONLY 1 of these should be running at a time
        // b/c there is no leader-election: https://github.com/kubernetes/autoscaler/issues/5481
        replicaCount = 1
        affinity     = module.util_updater.affinity
        tolerations  = module.util_updater.tolerations

        metrics = {
          serviceMonitor = {
            enabled   = var.monitoring_enabled
            namespace = local.namespace
            interval  = "60s"
            timeout   = "10s"
          }
        }

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

        podLabels = merge(
          # We must filter out the labels added by the helm chart b/c this will cause a duplicate label issue in kustomize
          { for k, v in module.util_admission_controller.labels : k => v if k != "app.kubernetes.io/name" && k != "app.kubernetes.io/component" },
          local.kustomization_labels
        )

        image = {
          repository = "${module.pull_through.kubernetes_registry}/autoscaling/vpa-admission-controller"
          tag        = var.vertical_autoscaler_image_version
        }

        annotations = {
          "reloader.stakater.com/auto" = "true"
        }

        // We do need at least 2 otherwise we may get stuck in a loop
        // b/c if this pod goes down, it cannot apply the appropriate
        // resource requirements when it comes back up and then the
        // updater will take it down again
        replicaCount = 2
        affinity     = module.util_admission_controller.affinity
        tolerations  = module.util_admission_controller.tolerations

        metrics = {
          serviceMonitor = {
            enabled   = var.monitoring_enabled
            namespace = local.namespace
            interval  = "60s"
            timeout   = "10s"
          }
        }

        podDisruptionBudget = {
          minAvailable               = 1
          unhealthyPodEvictionPolicy = "AlwaysAllow"
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

  dynamic "postrender" {
    for_each = var.panfactum_scheduler_enabled ? ["enabled"] : []
    content {
      binary_path = "${path.module}/kustomize/kustomize.sh"
    }
  }

  depends_on = [module.webhook_cert]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "vpa-dashboard"
    labels = merge(module.util_recommender.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "vpa.json" = file("${path.module}/dashboard.json")
  }
}

/***************************************
* VPA Resources
***************************************/

resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vpa-admission-controller"
      namespace = local.namespace
      labels    = module.util_admission_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vpa-admission-controller"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
}

resource "kubectl_manifest" "vpa_recommender" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vpa-recommender"
      namespace = local.namespace
      labels    = module.util_recommender.labels
    }
    spec = {
      resourcePolicy = {
        containerPolicies = [{
          containerName = "vpa"
          minAllowed = {
            memory = "125Mi"
          }
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vpa-recommender"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
}

resource "kubectl_manifest" "vpa_updater" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vpa-updater"
      namespace = local.namespace
      labels    = module.util_updater.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vpa-updater"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
}
