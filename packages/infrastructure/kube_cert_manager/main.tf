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
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
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

module "util_controller" {
  source                                = "../kube_workload_utility"
  workload_name                         = "cert-manager"
  instance_type_anti_affinity_preferred = true
  burstable_nodes_enabled               = true

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

module "util_webhook" {
  source                                = "../kube_workload_utility"
  workload_name                         = "cert-manager-webhook"
  instance_type_anti_affinity_preferred = true
  burstable_nodes_enabled               = true

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

module "util_ca_injector" {
  source                                = "../kube_workload_utility"
  workload_name                         = "cert-manager-ca-injector"
  instance_type_anti_affinity_preferred = true

  // This _can_ be run on a spot node if necessary as a short temporary disruption
  // will not cause cascading failures
  burstable_nodes_enabled = true

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

/***************************************
* Namespace
***************************************/

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
* Cert-manager
***************************************/

resource "kubernetes_service_account" "cert_manager" {
  metadata {
    name      = local.name
    namespace = local.namespace
    labels    = module.util_controller.labels
  }
}

resource "kubernetes_service_account" "webhook" {
  metadata {
    name      = local.webhook_name
    namespace = local.namespace
    labels    = module.util_webhook.labels
  }
}

module "webhook_cert" {
  count  = var.self_generated_certs_enabled ? 0 : 1
  source = "../kube_internal_cert"

  service_names = ["cert-manager-webhook"]
  common_name   = "cert-manager-webhook.cert-manager.svc"
  secret_name   = local.webhook_secret
  namespace     = local.namespace

  # generate: pass_common_vars_no_extra_tags.snippet.txt
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  # end-generate

  extra_tags = module.util_webhook.labels
}


resource "kubernetes_role" "webhook" {
  metadata {
    name      = local.webhook_name
    labels    = module.util_webhook.labels
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
    labels    = module.util_webhook.labels
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
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      fullnameOverride = "cert-manager"

      installCRDs = true
      global = {
        commonLabels = module.util_controller.labels

        // While the certificates are "critical" to the cluster, the provisioning infrastructure
        // can go down temporarily without taking down the cluster so this does not need to be "system-cluster-critical"
        priorityClassName = module.constants.cluster_important_priority_class_name
      }
      image = {
        repository = "${var.pull_through_cache_enabled ? module.pull_through[0].quay_registry : "quay.io"}/jetstack/cert-manager-controller"
      }
      replicaCount = 1
      strategy = {
        type = "Recreate"
      }
      podLabels = module.util_controller.labels
      affinity  = module.util_controller.affinity

      // This _can_ be run on a spot node if necessary as a short temporary disruption
      // will not cause cascading failures
      tolerations = module.util_controller.tolerations
      resources = {
        requests = {
          memory = "100Mi"
        }
        limits = {
          memory = "130Mi"
        }
      }
      livenessProbe = {
        enabled = true
      }
      extraArgs = [
        "--v=${var.log_verbosity}",
        "--enable-certificate-owner-ref" // Deletes secrets when the certificate is deleted
      ]
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
        podLabels   = module.util_webhook.labels
        tolerations = module.util_webhook.tolerations
        affinity    = module.util_webhook.affinity
        resources = {
          requests = {
            memory = "100Mi"
          }
          limits = {
            memory = "130Mi"
          }
        }

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
        replicaCount = 1
        strategy = {
          type = "Recreate"
        }
        extraArgs = ["--v=${var.log_verbosity}"]
        podLabels = module.util_ca_injector.labels
        affinity  = module.util_ca_injector.affinity

        tolerations = module.util_ca_injector.tolerations
        resources = {
          requests = {
            memory = "300Mi"
          }
          limits = {
            memory = "390Mi"
          }
        }
      }

      prometheus = {
        enabled = var.monitoring_enabled
        servicemonitor = {
          enabled  = var.monitoring_enabled
          interval = "60s"
          labels   = module.util_controller.labels
        }
      }
    })
  ]

  depends_on = [module.webhook_cert]
}

resource "kubernetes_config_map" "dashboard" {
  count = var.monitoring_enabled ? 1 : 0
  metadata {
    name   = "cert-manager-dashboard"
    labels = merge(module.util_controller.labels, { "grafana_dashboard" = "1" })
  }
  data = {
    "cert-manager.json" = file("${path.module}/dashboard.json")
  }
}

/***************************************
* Autoscaling
***************************************/

resource "kubernetes_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cert-manager"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "cert-manager"
      }
    }
  }
  depends_on = [helm_release.cert_manager]
}

resource "kubernetes_manifest" "vpa_cainjector" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cert-manager-cainjector"
      namespace = local.namespace
      labels    = module.util_ca_injector.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "cert-manager-cainjector"
      }
    }
  }
  depends_on = [helm_release.cert_manager]
}

resource "kubernetes_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "cert-manager-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "cert-manager-webhook"
      }
    }
  }
  depends_on = [helm_release.cert_manager]
}

resource "kubernetes_manifest" "pdb_controller" {
  manifest = {
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "cert-manager"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      selector = {
        matchLabels = module.util_controller.match_labels
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
      name      = "cert-manager-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      selector = {
        matchLabels = module.util_webhook.match_labels
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
      name      = "cert-manager-ca-injector"
      namespace = local.namespace
      labels    = module.util_ca_injector.labels
    }
    spec = {
      selector = {
        matchLabels = module.util_ca_injector.match_labels
      }
      maxUnavailable = 1
    }
  }
  depends_on = [helm_release.cert_manager]
}

/***************************************
* Canary Checks
***************************************/

resource "kubernetes_manifest" "canary" {
  count = var.canary_enabled ? 1 : 0
  manifest = {
    apiVersion = "canaries.flanksource.com/v1"
    kind       = "Canary"
    metadata = {
      name      = "cert-manager"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      schedule   = "@every 30s"
      http       = []
      kubernetes = []
      tcp = [
        {
          name     = "webhook service available"
          endpoint = "cert-manager-webhook.cert-manager:443"
        }
      ]
    }
  }
  field_manager {
    force_conflicts = true
  }
  depends_on = [helm_release.cert_manager]
}
