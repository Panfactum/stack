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
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
}

module "util" {
  source                               = "../kube_workload_utility"
  workload_name                        = "cnpg-operator"
  instance_type_anti_affinity_required = true
  burstable_nodes_enabled              = true

  # generate: common_vars.snippet.txt
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
  max_history     = 5

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
      labels    = module.util.labels
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
      labels    = module.util.labels
    }
    spec = {
      selector = {
        matchLabels = module.util.match_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cnpg]
}
