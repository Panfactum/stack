// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
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
  name      = "cloudnative-pg"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_cloudnative_pg"
}

module "pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = "cnpg-operator"
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target == 3
  host_anti_affinity_required          = var.sla_target == 3
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "constants" {
  source = "../kube_constants"
}

module "namespace" {
  source = "../kube_namespace"

  namespace = local.name
}

/***************************************
* Operator
***************************************/

module "webhook_cert" {
  source = "../kube_internal_cert"

  // These MUST be set with these exact values
  // as we will overwrite the hardcoded cert secret
  service_names = ["cnpg-webhook-service"]
  secret_name   = "cnpg-webhook-cert"
  namespace     = local.namespace
}

resource "helm_release" "cnpg" {
  namespace       = local.namespace
  name            = local.name
  repository      = "https://cloudnative-pg.github.io/charts"
  chart           = "cloudnative-pg"
  version         = var.cloudnative_pg_helm_version
  recreate_pods   = false
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  force_update    = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = local.name

      crds = {
        create = true
      }

      image = {
        repository = "${module.pull_through.github_registry}/cloudnative-pg/cloudnative-pg"
      }

      additionalArgs = [
        "--log-level=${var.log_level}"
      ]

      monitoring = {
        podMonitorEnabled          = var.monitoring_enabled
        podMonitorAdditionalLabels = module.util.labels
        grafanaDashboard = {
          create = var.monitoring_enabled
          labels = module.util.labels
        }
      }

      priorityClassName         = module.constants.cluster_important_priority_class_name
      replicaCount              = var.sla_target == 3 ? 2 : 1
      affinity                  = module.util.affinity
      tolerations               = module.util.tolerations
      topologySpreadConstraints = module.util.topology_spread_constraints

      podLabels = merge(
        module.util.labels,
        {
          customizationHash = md5(join("", [for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)]))
        }
      )
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }

      config = {
        data = {
          INHERITED_ANNOTATIONS = "linkerd.io/*, config.linkerd.io/*, resize.topolvm.io/*"
          INHERITED_LABELS      = "region, service, version_tag, module, app"
        }
      }

      resources = {
        requests = {
          memory = "200Mi"
        }
        limits = {
          memory = "260Mi"
        }
      }
    })
  ]

  depends_on = [module.webhook_cert]
}

resource "kubectl_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = local.name
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cnpg]
}

resource "kubectl_manifest" "pdb" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cnpg]
}

# This needs to be updated when the helm version is updated
module "image_cache" {
  source = "../kube_node_image_cache"
  images = [
    {
      registry   = "ghcr.io"
      repository = "cloudnative-pg/cloudnative-pg"
      tag        = "1.24.1"
    }
  ]
}

/***************************************
* Volume Snapshot Class (for backups)
***************************************/

resource "kubectl_manifest" "snapshot_class" {
  yaml_body = yamlencode({
    apiVersion = "snapshot.storage.k8s.io/v1"
    kind       = "VolumeSnapshotClass"
    metadata = {
      name   = "cnpg"
      labels = module.util.labels,
    }
    driver         = "ebs.csi.aws.com"
    deletionPolicy = "Delete"
    parameters = {
      tagSpecification_1 = "Namespace={{ .VolumeSnapshotNamespace }}"
      tagSpecification_2 = "Name={{ .VolumeSnapshotName }}"
      tagSpecification_3 = "ContentName={{ .VolumeSnapshotContentName }}"
    }
  })
}

/***************************************
* Fix for adding the VPA
* See: https://github.com/cloudnative-pg/cloudnative-pg/issues/2574
***************************************/


resource "kubernetes_cluster_role" "kyverno_background_controller" {
  metadata {
    name = "kyverno:background-controller:cnpg"
    labels = merge(data.pf_kube_labels.labels.labels, {
      "app.kubernetes.io/part-of"   = "kyverno"
      "app.kubernetes.io/instance"  = "kyverno"
      "app.kubernetes.io/component" = "background-controller"
    })
  }
  rule {
    api_groups = ["postgresql.cnpg.io"]
    verbs      = ["get", "list", "create", "update", "watch", "delete"]
    resources  = ["clusters", "backups", "clusterimagecatalogs", "imagecatalogs", "poolers", "scheduledbackups"]
  }
}

resource "kubernetes_cluster_role" "kyverno_admission_controller" {
  metadata {
    name = "kyverno:admission-controller:cnpg"
    labels = merge(data.pf_kube_labels.labels.labels, {
      "app.kubernetes.io/part-of"   = "kyverno"
      "app.kubernetes.io/instance"  = "kyverno"
      "app.kubernetes.io/component" = "admission-controller"
    })
  }
  rule {
    api_groups = ["postgresql.cnpg.io"]
    verbs      = ["get", "list", "create", "update", "watch", "delete"]
    resources  = ["clusters", "backups", "clusterimagecatalogs", "imagecatalogs", "poolers", "scheduledbackups"]
  }
}


resource "kubectl_manifest" "cnpg_scale_selector" {
  yaml_body = yamlencode({
    apiVersion = "kyverno.io/v1"
    kind       = "ClusterPolicy"
    metadata = {
      name   = "cnpg-scale-selector"
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      generateExisting             = true
      mutateExistingOnPolicyUpdate = true
      useServerSideApply           = true
      rules = [

        // This mutates the cluster CRD to be compatible with the VPA
        {
          name = "add-spec-selector-to-cluster-crd"
          match = {
            resources = {
              kinds = ["CustomResourceDefinition"]
              names = ["clusters.postgresql.cnpg.io"]
            }
          }
          mutate = {
            targets = [
              {
                apiVersion = "apiextensions.k8s.io/v1"
                kind       = "CustomResourceDefinition"
                name       = "clusters.postgresql.cnpg.io"
              }
            ]
            patchesJson6902 = yamlencode([
              {
                op   = "add"
                path = "/spec/versions/0/schema/openAPIV3Schema/properties/spec/properties/selector"
                value = {
                  type = "string"
                }
              },
              {
                op    = "add",
                path  = "/spec/versions/0/subresources/scale/labelSelectorPath"
                value = ".spec.selector"
              }
            ])
          }
        },

        // This mutates the cluster CRD to be compatible with the VPA
        {
          name = "add-spec-selector-to-pooler-crd"
          match = {
            resources = {
              kinds = ["CustomResourceDefinition"]
              names = ["poolers.postgresql.cnpg.io"]
            }
          }
          mutate = {
            targets = [
              {
                apiVersion = "apiextensions.k8s.io/v1"
                kind       = "CustomResourceDefinition"
                name       = "poolers.postgresql.cnpg.io"
              }
            ]
            patchesJson6902 = yamlencode([
              {
                op   = "add"
                path = "/spec/versions/0/schema/openAPIV3Schema/properties/spec/properties/selector"
                value = {
                  type = "string"
                }
              },
              {
                op    = "add",
                path  = "/spec/versions/0/subresources/scale/labelSelectorPath"
                value = ".spec.selector"
              }
            ])
          }
        },

        // This is necessary to prevent CNPG from removing the selector via
        // its mutating webhook
        {
          name = "remove-cnpg-mutating-webhook"
          match = {
            resources = {
              kinds = ["MutatingWebhookConfiguration"]
              names = ["cnpg-mutating-webhook-configuration"]
            }
          }
          mutate = {
            targets = [
              {
                apiVersion = "admissionregistration.k8s.io/v1"
                kind       = "MutatingWebhookConfiguration"
                name       = "cnpg-mutating-webhook-configuration"
              }
            ]
            patchesJson6902 = yamlencode([
              {
                op   = "remove"
                path = "/webhooks/1"
              }
            ])
          }
        },

        // This adds the selector to each cluster
        {
          name = "add-spec-selector-to-clusters"
          match = {
            resources = {
              kinds = ["postgresql.cnpg.io/v1/Cluster"]
            }
          }
          mutate = {
            targets = [
              {
                apiVersion = "postgresql.cnpg.io/v1"
                kind       = "Cluster"
                name       = "{{ request.object.metadata.name }}"
              }
            ]
            patchStrategicMerge = {
              spec = {
                selector = "cnpg.io/cluster={{ request.object.metadata.name }},cnpg.io/podRole=instance"
              }
            }
          }
        },

        // This adds the selector to each pooler
        {
          name = "add-spec-selector-to-poolers"
          match = {
            resources = {
              kinds = ["postgresql.cnpg.io/v1/Pooler"]
            }
          }
          mutate = {
            targets = [
              {
                apiVersion = "postgresql.cnpg.io/v1"
                kind       = "Pooler"
                name       = "{{ request.object.metadata.name }}"
              }
            ]
            patchStrategicMerge = {
              spec = {
                selector = "id={{ request.object.metadata.labels.id }},cnpg.io/podRole=pooler"
              }
            }
          }
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on = [
    helm_release.cnpg,
    kubernetes_cluster_role.kyverno_admission_controller,
    kubernetes_cluster_role.kyverno_background_controller
  ]
}