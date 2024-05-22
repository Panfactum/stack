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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  name      = "cloudnative-pg"
  namespace = module.namespace.namespace
  matching_labels = {
    id = random_id.controller_id.hex
  }
}

resource "random_id" "controller_id" {
  prefix      = "cnpg-"
  byte_length = 8
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "kube_labels" {
  source = "../kube_labels"

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.matching_labels)
}

module "constants" {
  source = "../constants"

  matching_labels = local.matching_labels

  # generate: common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  # end-generate

  extra_tags = merge(var.extra_tags, local.matching_labels)
}



module "namespace" {
  source = "../kube_namespace"

  namespace = local.name

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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

  # generate: pass_common_vars.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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

  values = [
    yamlencode({
      fullnameOverride = local.name

      crds = {
        create = true
      }

      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].github_registry : "ghcr.io"}/cloudnative-pg/cloudnative-pg"
      }

      additionalArgs = [
        "--log-level=${var.log_level}"
      ]

      monitoring = {
        podMonitorEnabled          = var.monitoring_enabled
        podMonitorAdditionalLabels = module.kube_labels.kube_labels
        grafanaDashboard = {
          create = var.monitoring_enabled
          labels = merge(
            module.kube_labels.kube_labels
          )
        }
      }

      priorityClassName = module.constants.cluster_important_priority_class_name
      replicaCount      = 2
      affinity = merge(
        module.constants.controller_node_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )
      tolerations               = module.constants.burstable_node_toleration_helm
      topologySpreadConstraints = module.constants.topology_spread_zone_preferred

      podLabels = merge(
        module.kube_labels.kube_labels,
        {
          customizationHash = md5(join("", [for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)]))
        }
      )
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }

      config = {
        data = {
          INHERITED_ANNOTATIONS = "linkerd.io/*, config.linkerd.io/*"
          INHERITED_LABELS      = "region, service, version_tag, module, app"
        }
      }

      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }
    })
  ]

  // Injects the CA data into the webhook manifest
  postrender {
    binary_path = "${path.module}/kustomize/kustomize.sh"
  }
}

resource "kubernetes_manifest" "vpa" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = local.name
      }
    }
  }
  depends_on = [helm_release.cnpg]
}

resource "kubernetes_manifest" "pdb" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = local.name
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = local.matching_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cnpg]
}
