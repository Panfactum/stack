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
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
  }
}

locals {

  name           = "cert-manager"
  webhook_name   = "cert-manger-webhook"
  namespace      = module.namespace.namespace
  webhook_secret = "cert-manager-webhook-certs"
}

module "pull_through" {
  count  = var.pull_through_cache_enabled ? 1 : 0
  source = "../aws_ecr_pull_through_cache_addresses"
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

resource "random_id" "controller_id" {
  prefix      = "${local.name}-"
  byte_length = 8
}

module "controller_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { id = random_id.controller_id.hex })
}

resource "random_id" "webhook" {
  prefix      = "${local.name}-webhook-"
  byte_length = 8
}

module "webhook_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { id = random_id.webhook.hex })
}

resource "random_id" "ca_injector" {
  prefix      = "${local.name}-ca-injector-"
  byte_length = 8
}

module "ca_injector_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { id = random_id.ca_injector.hex })
}

module "constants_controller" {
  source          = "../constants"
  matching_labels = { id = random_id.controller_id.hex }
  environment     = var.environment
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
}

module "constants_webhook" {
  source          = "../constants"
  matching_labels = { id = random_id.webhook.hex }
  environment     = var.environment
  pf_root_module  = var.pf_root_module
  region          = var.region
  is_local        = var.is_local
  extra_tags      = var.extra_tags
}

module "constants_ca_injector" {
  source          = "../constants"
  matching_labels = { id = random_id.ca_injector.hex }
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

resource "kubernetes_service_account" "webhook" {
  metadata {
    name      = local.webhook_name
    namespace = local.namespace
    labels    = module.webhook_labels.kube_labels
  }
}

module "webhook_cert" {
  count          = var.self_generated_certs_enabled ? 0 : 1
  source         = "../kube_internal_cert"
  service_names  = ["jetstack-cert-manager-webhook"]
  common_name    = "jetstack-cert-manager-webhook.cert-manager.svc"
  secret_name    = local.webhook_secret
  namespace      = local.namespace
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = module.webhook_labels.kube_labels
}


resource "kubernetes_role" "webhook" {
  metadata {
    name      = local.webhook_name
    labels    = module.webhook_labels.kube_labels
    namespace = local.namespace
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["list", "get", "watch", "update", "delete", "create"]
    resource_names = [
      local.webhook_secret,
      "jetstack-cert-manager-webhook-ca"
    ]
  }
  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["list"]
  }
}

resource "kubernetes_role_binding" "extra_permissions" {
  metadata {
    labels    = module.webhook_labels.kube_labels
    name      = local.webhook_name
    namespace = local.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.webhook.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.webhook.metadata[0].name
    namespace = local.namespace
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
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/jetstack/cert-manager-controller"
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
      extraArgs = ["--v=${var.log_verbosity}"]
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.cert_manager.metadata[0].name
      }
      securityContext = {
        fsGroup = 1001
      }
      webhook = {
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/jetstack/cert-manager-webhook"
        }
        replicaCount = 2
        extraArgs    = ["--v=${var.log_verbosity}"]
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.webhook.metadata[0].name
        }
        podLabels = module.webhook_labels.kube_labels
        affinity = merge(
          module.constants_webhook.controller_node_affinity_helm,
          module.constants_webhook.pod_anti_affinity_helm
        )
        //////////////////////////////////////////////////////////
        // This section replaces the self-generated certs with our certificate chain
        //////////////////////////////////////////////////////////
        config = var.self_generated_certs_enabled ? null : {
          apiVersion = "webhook.config.cert-manager.io/v1alpha1"
          kind       = "WebhookConfiguration"
          tlsConfig = {
            filesystem = {
              certFile = "/etc/certs/tls.crt"
              keyFile  = "/etc/certs/tls.key"
            }
          }
        }
        volumeMounts = var.self_generated_certs_enabled ? [] : [{
          name      = "certs"
          mountPath = "/etc/certs"
        }]
        volumes = var.self_generated_certs_enabled ? [] : [{
          name = "certs"
          secret = {
            secretName = local.webhook_secret
            optional   = false
          }
        }]
        // this must be inject-ca-from-secret to override the chart default
        mutatingWebhookConfigurationAnnotations = var.self_generated_certs_enabled ? null : {
          "cert-manager.io/inject-ca-from-secret" = "${local.namespace}/${local.webhook_secret}"
        }
        validatingWebhookConfigurationAnnotations = var.self_generated_certs_enabled ? null : {
          "cert-manager.io/inject-ca-from-secret" = "${local.namespace}/${local.webhook_secret}"
        }

      }
      cainjector = {
        image = {
          repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/jetstack/cert-manager-cainjector"
        }
        enabled      = true
        replicaCount = 2
        extraArgs    = ["--v=${var.log_verbosity}"]
        podLabels    = module.ca_injector_labels.kube_labels
        affinity = merge(
          module.constants_ca_injector.controller_node_affinity_helm,
          module.constants_ca_injector.pod_anti_affinity_helm
        )
      }
    })
  ]

  depends_on = [module.webhook_cert]
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
