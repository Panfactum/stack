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

  name      = "cert-manager"
  namespace = module.namespace.namespace

  // Extract values from the enforced kubernetes labels
  environment = var.environment
  module      = var.module
  version     = var.version_tag

  base_labels = var.kube_labels

  controller_labels = merge(local.base_labels, {
    service = local.name
  })
  webhook_labels = merge(local.base_labels, {
    service = "${local.name}-webhook"
  })
  ca_injector_labels = merge(local.base_labels, {
    service = "${local.name}-ca-injector"
  })
  trust_manager_labels = merge(local.base_labels, {
    service = "${local.name}-trust-manager"
  })
}

module "constants_controller" {
  source          = "../../modules/constants"
  matching_labels = local.controller_labels
}

module "constants_webhook" {
  source          = "../../modules/constants"
  matching_labels = local.webhook_labels
}

module "constants_ca_injector" {
  source          = "../../modules/constants"
  matching_labels = local.ca_injector_labels
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
  kube_labels       = local.controller_labels
}

/***************************************
* Cert-manager
***************************************/

resource "kubernetes_service_account" "cert_manager" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = local.controller_labels
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
        commonLabels      = local.base_labels
        priorityClassName = module.constants_controller.cluster_important_priority_class_name
      }

      // Does not need to be highly available
      replicaCount = 2
      podLabels    = local.controller_labels
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
        podLabels    = local.webhook_labels
        affinity = merge(
          module.constants_webhook.controller_node_affinity_helm,
          module.constants_webhook.pod_anti_affinity_helm
        )
      }
      cainjector = {
        enabled      = true
        replicaCount = 2
        extraArgs    = ["--v=0"]
        podLabels    = local.ca_injector_labels
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
      labels    = local.controller_labels
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
      labels    = local.ca_injector_labels
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
      labels    = local.webhook_labels
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
      labels    = local.controller_labels
    }
    spec = {
      selector = {
        matchLabels = local.controller_labels
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
      labels    = local.webhook_labels
    }
    spec = {
      selector = {
        matchLabels = local.webhook_labels
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
      labels    = local.ca_injector_labels
    }
    spec = {
      selector = {
        matchLabels = local.ca_injector_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cert_manager]
}

/***************************************
* Trust-manager
***************************************/

resource "helm_release" "trust_manager" {
  namespace       = local.namespace
  name            = "trust-manager"
  repository      = "https://charts.jetstack.io"
  chart           = "trust-manager"
  version         = var.trust_manager_version
  recreate_pods   = true
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      crds = {
        enabled = true
      }
      app = {
        trust = {
          namespace = local.namespace
        }
      }

      // Does not need to be highly available
      replicaCount = 1
      tolerations  = module.constants_controller.spot_node_toleration_helm
      affinity     = module.constants_controller.controller_node_with_spot_affinity_helm
    })
  ]

  // We want to use our secured internal certificate issuer
  // instead of the default self-signed one
  postrender {
    binary_path = "${path.module}/trust_manager_kustomize/kustomize.sh"
  }
}
