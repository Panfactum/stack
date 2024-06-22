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
  name      = "metrics-server"
  namespace = module.namespace.namespace
}

module "pull_through" {
  source                     = "../aws_ecr_pull_through_cache_addresses"
  pull_through_cache_enabled = var.pull_through_cache_enabled
}

module "util" {
  source                                = "../kube_workload_utility"
  workload_name                         = "metrics-server"
  burstable_nodes_enabled               = true
  arm_nodes_enabled                     = true
  panfactum_scheduler_enabled           = var.panfactum_scheduler_enabled
  instance_type_anti_affinity_preferred = var.enhanced_ha_enabled
  topology_spread_enabled               = var.enhanced_ha_enabled

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

/***************************************
* Kubernetes Resources
***************************************/

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

module "cert" {
  source = "../kube_internal_cert"

  secret_name   = "metrics-server-tls"
  service_names = ["metrics-server"]
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


resource "helm_release" "metrics_server" {
  namespace       = local.namespace
  name            = "metrics-server"
  repository      = "https://kubernetes-sigs.github.io/metrics-server/"
  chart           = "metrics-server"
  version         = var.metrics_server_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      commonLabels = module.util.labels
      podLabels    = module.util.labels
      deploymentAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }


      image = {
        repository = "${module.pull_through.kubernetes_registry}/metrics-server/metrics-server"
      }
      args = [
        "--v=${var.log_verbosity}",
        "--logging-format=json",
        "--metric-resolution=15s", // kubelets only scrape every 15s so any lower would be pointless
        "--tls-cert-file=/etc/certs/tls.crt",
        "--tls-private-key-file=/etc/certs/tls.key",
        "--tls-min-version=VersionTLS13"
      ]

      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }

      ///////////////////////////////////////
      // Monitoring
      ////////////////////////////////////////
      serviceMonitor = {
        enabled  = var.monitoring_enabled
        interval = "60s"
      }

      ///////////////////////////////////////
      // High Availability Config
      ////////////////////////////////////////
      replicas = 2
      affinity                  = module.util.affinity
      topologySpreadConstraints = module.util.topology_spread_constraints
      tolerations               = module.util.tolerations
      podDisruptionBudget = {
        enabled      = true
        minAvailable = 1
      }
      priorityClassName   = "system-cluster-critical"
      podDisruptionBudget = { enabled = false } # Created below
      schedulerName       = var.panfactum_scheduler_enabled ? module.constants.panfactum_scheduler_name : "default-scheduler"

      ///////////////////////////////////////
      // Custom Cert Config
      ////////////////////////////////////////
      extraVolumeMounts = [{
        name      = "certs"
        mountPath = "/etc/certs"
      }]
      extraVolumes = [{
        name = "certs"
        secret = {
          secretName = module.cert.secret_name
          optional   = false
        }
      }]
      apiService = {
        insecureSkipTLSVerify = false
        annotations = {
          "cert-manager.io/inject-ca-from" = "${local.namespace}/${module.cert.certificate_name}"
        }
      }

      ///////////////////////////////////////
      // Health checks
      ////////////////////////////////////////
      livenessProbe = {
        initialDelaySeconds = 20
        periodSeconds       = 10
        failureThreshold    = 3
      }
      readinessProbe = {
        initialDelaySeconds = 20
        periodSeconds       = 10
        failureThreshold    = 1
      }
    })
  ]
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
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.metrics_server]
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
  depends_on        = [helm_release.metrics_server]
}
