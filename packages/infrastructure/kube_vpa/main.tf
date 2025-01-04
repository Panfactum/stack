terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
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

data "pf_kube_labels" "labels" {
  module = "kube_vpa"
}

module "util_admission_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "vpa-admission-controller"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  match_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "admission-controller"
  }
  extra_labels = data.pf_kube_labels.labels.labels
}

module "util_recommender" {
  source = "../kube_workload_utility"

  workload_name                        = "vpa-recommender"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // single instance
  az_spread_preferred                  = false
  host_anti_affinity_required          = false // single instance
  match_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "recommender"
  }
  extra_labels = data.pf_kube_labels.labels.labels
}

module "util_updater" {
  source = "../kube_workload_utility"

  workload_name                        = "vpa-updater"
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  instance_type_anti_affinity_required = false // single instance
  az_spread_preferred                  = false
  host_anti_affinity_required          = false // single instance
  match_labels = {
    "app.kubernetes.io/name"      = "vpa"
    "app.kubernetes.io/component" = "updater"
  }
  extra_labels = data.pf_kube_labels.labels.labels
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
}

# ################################################################################
# Vertical Autoscaler
# ################################################################################

module "webhook_cert" {
  source = "../kube_internal_cert"

  service_names = ["vpa-webhook"]
  secret_name   = "vpa-webhook-certs"
  namespace     = local.namespace
}

resource "helm_release" "vpa" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://charts.fairwinds.com/stable"
  chart           = "vpa"
  version         = var.vertical_autoscaler_helm_version
  recreate_pods   = false
  atomic          = true
  force_update    = true
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
          tag = var.vertical_autoscaler_image_version
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
          "oom-min-bump-up-bytes"                 = 1024 * 1024 * 10

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
          tag = var.vertical_autoscaler_image_version
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
          tag = var.vertical_autoscaler_image_version
        }

        annotations = {
          "reloader.stakater.com/auto" = "true"
        }

        replicaCount = var.sla_target >= 2 ? 2 : 1
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

/***************************************
* Kyverno Integration
***************************************/

resource "kubernetes_cluster_role" "kyverno_background_controller" {
  metadata {
    name = "kyverno:background-controller:vpa"
    labels = merge(data.pf_kube_labels.labels.labels, {
      "app.kubernetes.io/part-of"   = "kyverno"
      "app.kubernetes.io/instance"  = "kyverno"
      "app.kubernetes.io/component" = "background-controller"
    })
  }
  rule {
    api_groups = ["autoscaling.k8s.io"]
    verbs      = ["get", "list", "create", "update", "watch", "delete"]
    resources  = ["verticalpodautoscalers", "verticalpodautoscalercheckpoints"]
  }
}

resource "kubernetes_cluster_role" "kyverno_admission_controller" {
  metadata {
    name = "kyverno:admission-controller:vpa"
    labels = merge(data.pf_kube_labels.labels.labels, {
      "app.kubernetes.io/part-of"   = "kyverno"
      "app.kubernetes.io/instance"  = "kyverno"
      "app.kubernetes.io/component" = "admission-controller"
    })
  }
  rule {
    api_groups = ["autoscaling.k8s.io"]
    verbs      = ["get", "list", "create", "update", "watch", "delete"]
    resources  = ["verticalpodautoscalers", "verticalpodautoscalercheckpoints"]
  }
}

resource "kubectl_manifest" "adjust_vpa_settings" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "Policy"
    metadata = {
      name      = "adjust-vpa-settings"
      namespace = local.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      rules = [
        {
          name = "adjust-update-settings"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["Deployment"]
                  operations = ["CREATE", "UPDATE"]
                  names = [
                    "vpa-admission-controller",
                    "vpa-recommender",
                    "vpa-updater"
                  ]
                }
              }
            ]
          }
          mutate = {
            mutateExistingOnPolicyUpdate = true
            targets = [{
              apiVersion = "apps/v1"
              kind       = "Deployment"
              name       = "{{ request.object.metadata.name }}"
            }]
            patchesJson6902 = yamlencode([
              {
                path = "/spec/strategy/rollingUpdate"
                value = {
                  maxSurge       = 0
                  maxUnavailable = 1
                }
                op = "replace"
              },
            ])
          }
        },
        {
          name = "add-topology-spread-contraints-to-ac"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["Pod"]
                  operations = ["CREATE"]
                  names = [
                    "vpa-admission-controller*"
                  ]
                }
              }
            ]
          }
          mutate = {
            patchesJson6902 = yamlencode([
              {
                path  = "/spec/topologySpreadConstraints"
                value = module.util_admission_controller.topology_spread_constraints
                op    = "add"
              },
            ])
          }
        },
        {
          name = "use-system-node-critical"
          match = {
            any = [
              {
                resources = {
                  kinds      = ["Pod"]
                  operations = ["CREATE"]
                  names      = ["vpa-admission-controller-*"]
                }
              }
            ]
          }
          mutate = {
            patchesJson6902 = yamlencode([
              {
                path  = "/spec/priorityClassName"
                value = "system-node-critical"
                op    = "replace"
              },
              # This is required to avoid an error by the priority admission controller
              {
                path = "/spec/priority"
                op   = "remove"
              }
            ])
          }
        }
      ]
      webhookConfiguration = {
        failurePolicy = "Ignore"
      }
    }
  })

  force_new         = true
  force_conflicts   = true
  server_side_apply = true
}