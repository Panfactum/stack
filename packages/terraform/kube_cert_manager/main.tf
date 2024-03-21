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
  }
}

locals {

  name      = "cert-manager"
  namespace = module.namespace.namespace

}

module "base_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

module "controller_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { service = local.name })
}

module "webhook_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { service = "${local.name}-webhook" })
}

module "ca_injector_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { service = "${local.name}-ca-injector" })
}

module "constants_controller" {
  source          = "../constants"
  matching_labels = module.controller_labels.kube_labels
  environment     = var.environment
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
}

module "constants_webhook" {
  source          = "../constants"
  matching_labels = module.webhook_labels.kube_labels
  environment     = var.environment
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
}

module "constants_ca_injector" {
  source          = "../constants"
  matching_labels = module.ca_injector_labels.kube_labels
  environment     = var.environment
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
}

/***************************************
* Namespace
***************************************/

module "namespace" {
  source         = "../kube_namespace"
  namespace      = local.name
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
}

/***************************************
* Cert-manager
***************************************/

resource "kubernetes_service_account" "cert_manager" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.controller_labels.kube_labels
  }
}

resource "helm_release" "cert_manager" {
  namespace       = local.namespace
  name            = "jetstack"
  repository      = "https://charts.jetstack.io"
  chart           = "cert-manager"
  version         = var.cert_manager_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      installCRDs = true
      global = {
        commonLabels      = module.base_labels.kube_labels
        priorityClassName = module.constants_controller.cluster_important_priority_class_name
      }
      replicaCount = 2
      podLabels    = module.controller_labels.kube_labels
      affinity = merge(
        module.constants_controller.controller_node_affinity_helm,
        module.constants_controller.pod_anti_affinity_helm
      )

      livenessProbe = {
        enabled = true
      }
      extraArgs = ["--v=0"]
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.cert_manager.metadata[0].name
      }
      securityContext = {
        fsGroup = 1001
      }
      webhook = {
        replicaCount = 2
        extraArgs    = ["--v=0"]
        podLabels    = module.webhook_labels.kube_labels
        affinity = merge(
          module.constants_webhook.controller_node_affinity_helm,
          module.constants_webhook.pod_anti_affinity_helm
        )
      }
      cainjector = {
        enabled      = true
        replicaCount = 2
        extraArgs    = ["--v=0"]
        podLabels    = module.ca_injector_labels.kube_labels
        affinity = merge(
          module.constants_ca_injector.controller_node_affinity_helm,
          module.constants_ca_injector.pod_anti_affinity_helm
        )
      }
    })
  ]
}

resource "kubernetes_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "jetstack-cert-manager"
      namespace = local.namespace
      labels    = module.controller_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "jetstack-cert-manager"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_cainjector" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "jetstack-cert-manager-cainjector"
      namespace = local.namespace
      labels    = module.ca_injector_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "jetstack-cert-manager-cainjector"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "jetstack-cert-manager-webhook"
      namespace = local.namespace
      labels    = module.webhook_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "jetstack-cert-manager-webhook"
      }
    }
  }
}

resource "kubernetes_manifest" "pdb_controller" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb"
      namespace = local.namespace
      labels    = module.controller_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.controller_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cert_manager]
}

resource "kubernetes_manifest" "pdb_webhook" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb-webhook"
      namespace = local.namespace
      labels    = module.webhook_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.webhook_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cert_manager]
}

resource "kubernetes_manifest" "pdb_ca_injector" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "${local.name}-pdb-ca-injector"
      namespace = local.namespace
      labels    = module.ca_injector_labels.kube_labels
    }
    spec = {
      selector = {
        matchLabels = module.ca_injector_labels.kube_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cert_manager]
}
