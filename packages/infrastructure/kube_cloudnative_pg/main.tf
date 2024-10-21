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
      version = "5.70.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  name      = "cloudnative-pg"
  namespace = module.namespace.namespace
}

data "pf_kube_labels" "labels" {
  module = "kube_alloy"
}

module "pull_through" {
  source = "../aws_ecr_pull_through_cache_addresses"

  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util" {
  source = "../kube_workload_utility"

  workload_name                        = "cnpg-operator"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
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
  cleanup_on_fail = true
  wait            = true
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
      replicaCount              = 2
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

  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
    args        = [var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"]
  }

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

resource "kubectl_manifest" "proxy_image_cache" {
  count = var.node_image_cache_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "kubefledged.io/v1alpha2"
    kind       = "ImageCache"
    metadata = {
      name      = "cnpg"
      namespace = local.namespace
      labels    = module.util.labels
    }
    spec = {
      cacheSpec = [
        {
          # We want to minimize disruption caused by databases moving across nodes so we ensure
          # that the necessary images are always already available (don't forget to update when updating cnpg)
          images = [
            "${module.pull_through.github_registry}/cloudnative-pg/cloudnative-pg:1.23.1",
            "${module.pull_through.github_registry}/cloudnative-pg/pgbouncer:1.22.1",
            "${module.pull_through.github_registry}/cloudnative-pg/postgresql:16.2-10"
          ]
        }
      ]
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cnpg]
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