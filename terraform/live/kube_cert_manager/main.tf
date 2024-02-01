// Live

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

}

module "base_labels" {
  source       = "../../modules/kube_labels"
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "controller_labels" {
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

module "webhook_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    service = "${local.name}-webhook"
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "ca_injector_labels" {
  source = "../../modules/kube_labels"
  additional_labels = {
    service = "${local.name}-ca-injector"
  }
  app          = var.app
  environment  = var.environment
  module       = var.module
  region       = var.region
  version_tag  = var.version_tag
  version_hash = var.version_hash
  is_local     = var.is_local
}

module "constants_controller" {
  source          = "../../modules/constants"
  matching_labels = module.controller_labels.kube_labels
  app             = var.app
  environment     = var.environment
  module          = var.module
  region          = var.region
  version_tag     = var.version_tag
  version_hash    = var.version_hash
  is_local        = var.is_local
}

module "constants_webhook" {
  source          = "../../modules/constants"
  matching_labels = module.webhook_labels.kube_labels
  app             = var.app
  environment     = var.environment
  module          = var.module
  region          = var.region
  version_tag     = var.version_tag
  version_hash    = var.version_hash
  is_local        = var.is_local
}

module "constants_ca_injector" {
  source          = "../../modules/constants"
  matching_labels = module.ca_injector_labels.kube_labels
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

      // Does not need to be highly available
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
