terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.10.1"
    }
  }
}

locals {

  name      = "arc-systems"
  namespace = module.namespace.namespace

}

module "kube_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    service = local.name
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "constants" {
  source          = "../../modules/constants"
  matching_labels = module.kube_labels.kube_labels
  app             = var.app
  environment     = var.environment
  module          = var.module
  region          = var.region
  version_tag     = var.version_tag
  version_hash    = var.version_hash
  is_local        = var.is_local
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source            = "../../modules/kube_namespace"
  namespace         = local.name
  admin_groups      = ["system:admins"]
  reader_groups     = ["system:readers"]
  bot_reader_groups = ["system:bot-readers"]
  app               = var.app
  environment       = var.environment
  module            = var.module
  region            = var.region
  version_tag       = var.version_tag
  version_hash      = var.version_hash
  is_local          = var.is_local
}

/***************************************
* Controller
***************************************/

resource "kubernetes_service_account" "arc" {
  metadata {
    name      = "gha-runner-scale-set-controller"
    namespace = local.namespace
    labels    = module.kube_labels.kube_labels
  }
}

resource "helm_release" "arc" {
  namespace       = local.namespace
  name            = "gha-runner-scale-set-controller"
  repository      = "oci://ghcr.io/actions/actions-runner-controller-charts/"
  chart           = "gha-runner-scale-set-controller"
  version         = var.gha_runner_scale_set_controller_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      replicaCount = 2
      labels       = module.kube_labels.kube_labels
      podLabels    = module.kube_labels.kube_labels // This won't work until 0.6.2

      serviceAccount = {
        create = false
        name   = kubernetes_service_account.arc.metadata[0].name
      }

      securityContext = {
        capabilities             = { drop = ["ALL"] }
        readOnlyRootFilesystem   = true
        runAsNonRoot             = true
        runAsUser                = 1000
        allowPrivilegeEscalation = false
      }

      priorityClassName = module.constants.cluster_important_priority_class_name

      tolerations = module.constants.spot_node_toleration_helm
      affinity = merge(
        module.constants.controller_node_with_spot_affinity_helm,
        module.constants.pod_anti_affinity_helm
      )

      flags = {
        logLevel  = "info"
        logFormat = "json"
      }

      metrics = {
        controllerManagerAddr = ":8080"
        listenerAddr          = ":8080"
        listenerEndpoint      = "/metrics"
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
      name      = "arc-controller"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "gha-runner-scale-set-controller-gha-rs-controller"
      }
    }
  }
  depends_on = [helm_release.arc]
}

resource "kubernetes_manifest" "pdb_controller" {
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
        matchLabels = module.kube_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.arc]
}
