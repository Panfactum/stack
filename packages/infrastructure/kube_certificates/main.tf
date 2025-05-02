terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
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
      version = "0.0.7"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
  }
}

locals {
  name           = "cert-manager"
  webhook_name   = "cert-manager-webhook"
  namespace      = module.namespace.namespace
  webhook_secret = "cert-manager-webhook-certs"

  ci_public_name       = "public"
  ci_internal_name     = "internal"
  ci_internal_rsa_name = "internal-rsa"
  ci_internal_ca_name  = "internal-ca"

  route53_solvers = [
    for domain, config in var.route53_zones : {
      dns01 = {
        route53 = {
          hostedZoneID = config.zone_id
          region       = data.aws_region.main.name
          role         = config.record_manager_role_arn
        }
      }
      selector = {
        dnsZones = [domain]
      }
    }
  ]

  cloudflare_solvers = [
    for domain in var.cloudflare_zones : {
      dns01 = {
        cloudflare = {
          email = var.alert_email
          apiTokenSecretRef = {
            name = kubernetes_secret.cloudflare_api_token.metadata[0].name
            key  = "api-token"
          }
        }
      }
      selector = {
        dnsZones = [domain]
      }
    }
  ]

  lets_encrypt_solvers = concat(local.route53_solvers, local.cloudflare_solvers)

  all_domains = tolist(toset(concat(
    [for domain, _ in var.route53_zones : domain],
    [for _, domain in var.cloudflare_zones : domain],
    [var.kube_domain]
  )))

  all_domains_with_subdomains = flatten([for domain in local.all_domains : (alltrue([for possible_parent in local.all_domains : (domain == possible_parent || !endswith(domain, possible_parent))]) ? [domain, "*.${domain}"] : ["*.${domain}"])])
  cluster_name                = data.pf_metadata.metadata.kube_cluster_name
}

data "aws_region" "main" {}

data "pf_kube_labels" "labels" {
  module = "kube_certificates"
}

data "pf_metadata" "metadata" {}

module "util_controller" {
  source = "../kube_workload_utility"

  workload_name                        = "cert-manager"
  az_spread_preferred                  = false // single instance
  host_anti_affinity_required          = false // single instance
  instance_type_anti_affinity_required = false // single instance
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_webhook" {
  source = "../kube_workload_utility"

  workload_name                        = "cert-manager-webhook"
  instance_type_anti_affinity_required = var.sla_target == 3
  az_spread_preferred                  = var.sla_target >= 2
  host_anti_affinity_required          = var.sla_target >= 2
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
}

module "util_ca_injector" {
  source = "../kube_workload_utility"

  workload_name                        = "cert-manager-ca-injector"
  az_spread_preferred                  = false // single instance
  host_anti_affinity_required          = false // single instance
  instance_type_anti_affinity_required = false // single instance
  panfactum_scheduler_enabled          = var.panfactum_scheduler_enabled
  pull_through_cache_enabled           = var.pull_through_cache_enabled
  burstable_nodes_enabled              = var.burstable_nodes_enabled
  controller_nodes_enabled             = var.controller_nodes_enabled
  spot_nodes_enabled                   = var.spot_nodes_enabled
  extra_labels                         = data.pf_kube_labels.labels.labels
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
* IRSA
***************************************/

module "aws_permissions" {
  count = length(var.route53_zones) > 0 ? 1 : 0

  source = "../kube_sa_auth_aws"

  service_account           = var.service_account
  service_account_namespace = var.namespace
  iam_policy_json           = data.aws_iam_policy_document.permissions.json
  ip_allow_list             = var.aws_iam_ip_allow_list
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
  atomic          = var.wait
  cleanup_on_fail = var.wait
  wait            = var.wait
  force_update    = true
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
        replicaCount = var.sla_target >= 2 ? 2 : 1
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
        config = var.self_generated_certs_enabled ? {
          apiVersion = "webhook.config.cert-manager.io/v1alpha1"
          kind       = "WebhookConfiguration"
          tlsConfig  = {}
          } : {
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
        mutatingWebhookConfigurationAnnotations = var.self_generated_certs_enabled ? {} : {
          "cert-manager.io/inject-ca-from-secret" = "${local.namespace}/${local.webhook_secret}"
        }
        validatingWebhookConfigurationAnnotations = var.self_generated_certs_enabled ? {} : {
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

  depends_on = [module.webhook_cert, module.aws_permissions]
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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
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
      updatePolicy = {
        updateMode = "Auto"
        evictionRequirements = [{
          resources         = ["cpu", "memory"]
          changeRequirement = "TargetHigherThanRequests"
        }]
      }
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

/***************************************
* Cluster Issuer - Public
***************************************/

data "aws_iam_policy_document" "permissions" {
  statement {
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = [for domain, config in var.route53_zones : config.record_manager_role_arn]
  }
}

resource "kubernetes_secret" "cloudflare_api_token" {
  metadata {
    name      = "cloudflare-api-token"
    namespace = var.namespace
  }

  type = "Opaque"

  data = {
    "api-token" = var.cloudflare_api_token
  }
}

// the default issuer for PUBLIC tls certs in the default DNS zone for the env
resource "kubectl_manifest" "cluster_issuer" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_public_name
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      acme = {
        email  = var.alert_email
        server = "https://acme-v02.api.letsencrypt.org/directory"
        privateKeySecretRef = {
          name = "letsencrypt-cert-key"
        }
        solvers = local.lets_encrypt_solvers
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [helm_release.cert_manager, module.aws_permissions]
}

/***************************************
* Cluster Issuer - Internal
***************************************/

resource "vault_mount" "pki_internal" {
  path                      = "pki/internal"
  type                      = "pki"
  description               = "Internal root CA for the ${local.cluster_name} cluster"
  default_lease_ttl_seconds = 60 * 60 * 24
  max_lease_ttl_seconds     = 60 * 60 * 24 * 365 * 10
}

resource "vault_pki_secret_backend_root_cert" "pki_internal" {
  backend              = vault_mount.pki_internal.path
  type                 = "internal"
  common_name          = var.vault_internal_url
  ttl                  = 60 * 60 * 24 * 365 * 10
  format               = "pem"
  private_key_format   = "der"
  key_type             = "ec"
  key_bits             = 256
  exclude_cn_from_sans = true
  ou                   = "engineering"
  organization         = "panfactum"
}

resource "vault_pki_secret_backend_config_urls" "pki_internal" {
  backend = vault_mount.pki_internal.path
  issuing_certificates = [
    "${var.vault_internal_url}/v1/pki/ca"
  ]
  crl_distribution_points = [
    "${var.vault_internal_url}/v1/pki/crl"
  ]
}

//////////////////////////////////
/// Regular certs
//////////////////////////////////

resource "kubernetes_service_account" "vault_issuer" {
  metadata {
    name      = "vault-issuer"
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

resource "kubernetes_role" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  rule {
    verbs          = ["create"]
    resources      = ["serviceaccounts/token"]
    resource_names = [kubernetes_service_account.vault_issuer.metadata[0].name]
    api_groups     = [""]
  }
}

resource "kubernetes_role_binding" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.vault_issuer.metadata[0].name
  }
}

data "vault_policy_document" "vault_issuer" {
  rule {
    capabilities = ["create", "read", "update"]
    path         = "${vault_mount.pki_internal.path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
  }
}

module "vault_role" {
  source = "../kube_sa_auth_vault"

  service_account           = kubernetes_service_account.vault_issuer.metadata[0].name
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_issuer.hcl
  audience                  = "vault://${local.ci_internal_name}"
  token_ttl_seconds         = 120
}

resource "vault_pki_secret_backend_role" "vault_issuer" {
  backend = vault_mount.pki_internal.path
  name    = kubernetes_service_account.vault_issuer.metadata[0].name

  // This is super permissive b/c these certificates are only used for
  // internal traffic encryption
  allow_any_name              = true
  allow_wildcard_certificates = true
  enforce_hostnames           = false
  allow_ip_sans               = true
  require_cn                  = false

  key_type = "ec"
  key_bits = 256

  max_ttl = 60 * 60 * 24 * 90 // Internal certs need to be rotated at least quarterly
}

resource "kubectl_manifest" "internal_ci" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_internal_name
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      vault = {
        path   = "${vault_mount.pki_internal.path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = module.vault_role.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.vault_issuer.metadata[0].name
            }
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true

  depends_on = [helm_release.cert_manager]
}

# Make sure this CA data is available in all namespaces for mTLS
resource "kubernetes_config_map" "ca_bundle" {
  metadata {
    name      = "internal-ca"
    labels    = data.pf_kube_labels.labels.labels
    namespace = var.namespace
  }
  data = {
    "ca.crt" = vault_pki_secret_backend_root_cert.pki_internal.issuing_ca
  }
}

module "sync_ca_bundle" {
  source = "../kube_sync_config_map"

  config_map_name      = kubernetes_config_map.ca_bundle.metadata[0].name
  config_map_namespace = kubernetes_config_map.ca_bundle.metadata[0].namespace
}

//////////////////////////////////
/// Regular certs - RSA
//////////////////////////////////

resource "kubernetes_service_account" "vault_rsa_issuer" {
  metadata {
    name      = "vault-issuer-rsa"
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

resource "kubernetes_role" "vault_rsa_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_rsa_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  rule {
    verbs          = ["create"]
    resources      = ["serviceaccounts/token"]
    resource_names = [kubernetes_service_account.vault_rsa_issuer.metadata[0].name]
    api_groups     = [""]
  }
}

resource "kubernetes_role_binding" "vault_rsa_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_rsa_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.vault_rsa_issuer.metadata[0].name
  }
}

data "vault_policy_document" "vault_rsa_issuer" {
  rule {
    capabilities = ["create", "read", "update"]
    path         = "${vault_mount.pki_internal.path}/sign/${vault_pki_secret_backend_role.vault_rsa_issuer.name}"
  }
}

module "vault_rsa_role" {
  source = "../kube_sa_auth_vault"

  service_account           = kubernetes_service_account.vault_rsa_issuer.metadata[0].name
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_rsa_issuer.hcl
  audience                  = "vault://${local.ci_internal_rsa_name}"
  token_ttl_seconds         = 120
}

resource "vault_pki_secret_backend_role" "vault_rsa_issuer" {
  backend = vault_mount.pki_internal.path
  name    = kubernetes_service_account.vault_rsa_issuer.metadata[0].name

  // This is super permissive b/c these certificates are only used for
  // internal traffic encryption
  allow_any_name              = true
  allow_wildcard_certificates = true
  enforce_hostnames           = false
  allow_ip_sans               = true
  require_cn                  = false

  key_type = "rsa"
  key_bits = 4096

  max_ttl = 60 * 60 * 24 * 90 // Internal certs need to be rotated at least quarterly
}

resource "kubectl_manifest" "internal_rsa_ci" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_internal_rsa_name
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      vault = {
        path   = "${vault_mount.pki_internal.path}/sign/${vault_pki_secret_backend_role.vault_rsa_issuer.name}"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = module.vault_rsa_role.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.vault_rsa_issuer.metadata[0].name
            }
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true

  depends_on = [helm_release.cert_manager]
}

//////////////////////////////////
/// CA certs
//////////////////////////////////

resource "kubernetes_service_account" "vault_ca_issuer" {
  metadata {
    name      = "vault-ca-issuer"
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

resource "kubernetes_role" "vault_ca_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_ca_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  rule {
    verbs          = ["create"]
    resources      = ["serviceaccounts/token"]
    resource_names = [kubernetes_service_account.vault_ca_issuer.metadata[0].name]
    api_groups     = [""]
  }
}

resource "kubernetes_role_binding" "vault_ca_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_ca_issuer.metadata[0].name
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = var.namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.vault_ca_issuer.metadata[0].name
  }
}

data "vault_policy_document" "vault_ca_issuer" {
  rule {
    capabilities = ["create", "read", "update"]
    path         = "${vault_mount.pki_internal.path}/root/sign-intermediate"
  }
}

module "vault_ca_role" {
  source = "../kube_sa_auth_vault"

  service_account           = kubernetes_service_account.vault_ca_issuer.metadata[0].name
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_ca_issuer.hcl
  audience                  = "vault://${local.ci_internal_ca_name}"
  token_ttl_seconds         = 120
}

resource "vault_pki_secret_backend_role" "vault_ca_issuer" {
  backend = vault_mount.pki_internal.path
  name    = kubernetes_service_account.vault_ca_issuer.metadata[0].name

  // This is super permissive b/c these certificates are only used for
  // internal traffic encryption
  allow_any_name              = true
  allow_wildcard_certificates = true
  enforce_hostnames           = false
  allow_ip_sans               = true
  require_cn                  = false

  key_type = "ec"
  key_bits = 256

  max_ttl = 60 * 60 * 24 * 90 // Internal certs need to be rotated at least quarterly
}

resource "kubectl_manifest" "internal_ca_ci" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_internal_ca_name
      labels = data.pf_kube_labels.labels.labels
    }
    spec = {
      vault = {
        path   = "${vault_mount.pki_internal.path}/root/sign-intermediate"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = module.vault_ca_role.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.vault_ca_issuer.metadata[0].name
            }
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true

  depends_on = [helm_release.cert_manager]
}

//////////////////////////////////
/// Ingress Cert
//////////////////////////////////

resource "kubectl_manifest" "ingress_cert" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = "ingress-tls"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      secretName = "ingress-tls"
      dnsNames   = local.all_domains_with_subdomains

      // We don't rotate this as frequently to both respect
      // the rate limits: https://letsencrypt.org/docs/rate-limits/
      // and to avoid getting the 30 day renewal reminders
      duration    = "2160h0m0s"
      renewBefore = "720h0m0s"

      privateKey = {
        rotationPolicy = "Always"
      }

      issuerRef = {
        name  = local.ci_public_name
        kind  = "ClusterIssuer"
        group = "cert-manager.io"
      }
    }
  })

  force_conflicts   = true
  server_side_apply = true

  wait_for {
    field {
      key   = "status.conditions.[0].status"
      value = "True"
    }
  }

  depends_on = [kubectl_manifest.cluster_issuer, helm_release.cert_manager]
}
