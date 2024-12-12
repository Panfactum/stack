terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

locals {
  name           = "cert-manager"
  webhook_name   = "cert-manger-webhook"
  namespace      = module.namespace.namespace
  webhook_secret = "cert-manager-webhook-certs"
}

data "pf_kube_labels" "labels" {
  module = "kube_cert_manager"
}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name               = "cert-manager"
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  burstable_nodes_enabled     = true
  controller_nodes_enabled    = true
  extra_labels                = data.pf_kube_labels.labels.labels
}

module "util_webhook" {
  source = "../kube_workload_utility"

  workload_name                        = "cert-manager-webhook"
  instance_type_anti_affinity_required = var.enhanced_ha_enabled
  az_spread_preferred                  = var.enhanced_ha_enabled
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = true
  controller_nodes_enabled             = true
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_ca_injector" {
  source = "../kube_workload_utility"

  workload_name               = "cert-manager-ca-injector"
  az_spread_preferred         = var.enhanced_ha_enabled
  panfactum_scheduler_enabled = var.panfactum_scheduler_enabled
  pull_through_cache_enabled  = var.pull_through_cache_enabled
  controller_nodes_enabled    = true
  burstable_nodes_enabled     = true
  extra_labels                = data.pf_kube_labels.labels.labels
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
  max_history     = 5

  values = [
    yamlencode({
      fullnameOverride = "cert-manager"

      installCRDs = true
      global = {
        # Bug exists here where the labels are also applied to pods which messes up the postrender
        # commonLabels = module.util_controller.labels

        // While the certificates are "critical" to the cluster, the provisioning infrastructure
        // can go down temporarily without taking down the cluster so this does not need to be "system-cluster-critical"
        priorityClassName = module.constants.cluster_important_priority_class_name
      }
      replicaCount = 1
      strategy = {
        type = "Recreate"
      }
      podLabels = merge(
        module.util_controller.labels,
        {
          customizationHash = md5(join("", [
            for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
          ]))
        }
      )
      affinity = module.util_controller.affinity

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
        "--v=${var.log_verbosity}"
      ]
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.cert_manager.metadata[0].name
      }
      securityContext = {
        fsGroup = 1001
      }
      webhook = {
        replicaCount = 2
        extraArgs    = ["--v=${var.log_verbosity}"]
        serviceAccount = {
          create = false
          name   = kubernetes_service_account.webhook.metadata[0].name
        }
        podLabels = merge(
          module.util_webhook.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
            ]))
          }
        )
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
        enabled      = true
        replicaCount = 1
        strategy = {
          type = "Recreate"
        }
        extraArgs = ["--v=${var.log_verbosity}"]
        podLabels = merge(
          module.util_ca_injector.labels,
          {
            customizationHash = md5(join("", [
              for filename in sort(fileset(path.module, "kustomize/*")) : filesha256(filename)
            ]))
          }
        )

        affinity    = module.util_ca_injector.affinity
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

resource "kubectl_manifest" "vpa_controller" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager]
}

resource "kubectl_manifest" "vpa_cainjector" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager]
}

resource "kubectl_manifest" "vpa_webhook" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
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
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager]
}

resource "kubectl_manifest" "pdb_controller" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "cert-manager"
      namespace = local.namespace
      labels    = module.util_controller.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_controller.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager]
}

resource "kubectl_manifest" "pdb_webhook" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "cert-manager-webhook"
      namespace = local.namespace
      labels    = module.util_webhook.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_webhook.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager]
}

resource "kubectl_manifest" "pdb_ca_injector" {
  yaml_body = yamlencode({
    apiVersion = "policy/v1"
    kind       = "PodDisruptionBudget"
    metadata = {
      name      = "cert-manager-ca-injector"
      namespace = local.namespace
      labels    = module.util_ca_injector.labels
    }
    spec = {
      unhealthyPodEvictionPolicy = "AlwaysAllow"
      selector = {
        matchLabels = module.util_ca_injector.match_labels
      }
      maxUnavailable = 1
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager]
}
