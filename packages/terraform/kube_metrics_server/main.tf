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
  name      = "metrics-server"
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

module "constants" {
  source = "../constants"

  matching_labels = {
    "app.kubernetes.io/name" = "metrics-server"
  }

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
}

/***************************************
* Kubernetes Resources
***************************************/

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

module "cert" {
  source = "../kube_internal_cert"

  secret_name   = "metrics-server-tls"
  service_names = ["metrics-server"]
  namespace     = local.namespace

  pf_stack_edition = var.pf_stack_edition
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  pf_root_module   = var.pf_root_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = var.extra_tags
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

  values = [
    yamlencode({
      commonLabels = module.kube_labels.kube_labels
      podLabels    = module.kube_labels.kube_labels
      podAnnotations = {
        "config.alpha.linkerd.io/proxy-enable-native-sidecar" = "true"
      }
      deploymentAnnotations = {
        "reloader.stakater.com/auto" = "true"
      }


      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].kubernetes_registry : "registry.k8s.io"}/metrics-server/metrics-server"
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
          memory = "150Mi"
        }
      }

      ///////////////////////////////////////
      // High Availability Config
      ////////////////////////////////////////
      replicas = 2
      affinity = merge(
        module.constants.controller_node_with_burstable_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )
      topologySpreadConstraints = module.constants.topology_spread_zone_strict
      tolerations               = module.constants.burstable_node_toleration_helm
      podDisruptionBudget = {
        enabled      = true
        minAvailable = 1
      }
      priorityClassName = "system-cluster-critical"


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
}
