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

  name      = "linkerd"
  namespace = module.namespace.namespace

  linkerd_vault_issuer                     = "linkerd-vault-issuer"
  linkerd_root_ca_secret                   = "linkerd-identity-trust-roots" # MUST be named this
  linkerd_root_issuer                      = "linkerd-root-issuer"
  linkerd_identity_issuer                  = "linkerd-identity-issuer"
  linkerd_identity_ca_secret               = "linkerd-identity-issuer"
  linkerd_policy_validator_webhook_secret  = "linkerd-policy-validator-k8s-tls" # MUST be named this
  linkerd_proxy_injector_webhook_secret    = "linkerd-proxy-injector-k8s-tls"   # MUST be named this
  linkerd_profile_validator_webhook_secret = "linkerd-sp-validator-k8s-tls"     # MUST be named this

  linkerd_submodule = "linkerd"
  linkerd_labels = merge(module.kube_labels.kube_labels, {
    submodule = local.linkerd_submodule
  })

  linkerd_cni_submodule = "linkerd-cni"
  linkerd_cni_labels = merge(module.kube_labels.kube_labels, {
    submodule = local.linkerd_cni_submodule
  })
}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { service = local.name })
}

module "constants" {
  source         = "../constants"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
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
* Setup Certs
* See docs here: https://github.com/BuoyantIO/cert-manager-workshop/tree/main
***************************************/


///////////////////////////////////////////
// Step 1: Set up linkerd root CA by getting it issued
// from Vault
//
// Notes:
//   - This MUST be in the cert-manager namespace
//     for trust-manager to work and for security
///////////////////////////////////////////

resource "kubernetes_service_account" "linkerd_vault_issuer" {
  metadata {
    name      = local.linkerd_vault_issuer
    namespace = var.cert_manager_namespace
  }
}

resource "kubernetes_role" "linkerd_vault_issuer" {
  metadata {
    name      = local.linkerd_vault_issuer
    namespace = var.cert_manager_namespace
  }
  rule {
    verbs          = ["create"]
    resources      = ["serviceaccounts/token"]
    resource_names = [kubernetes_service_account.linkerd_vault_issuer.metadata[0].name]
    api_groups     = [""]
  }
}

resource "kubernetes_role_binding" "linkerd_vault_issuer" {
  metadata {
    name      = local.linkerd_vault_issuer
    namespace = var.cert_manager_namespace
  }
  subject {
    kind      = "ServiceAccount"
    name      = "cert-manager"
    namespace = var.cert_manager_namespace
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.linkerd_vault_issuer.metadata[0].name
  }
}

data "vault_policy_document" "linkerd_vault_issuer" {
  rule {
    capabilities = ["create", "read", "update"]
    path         = "${var.vault_internal_pki_path}/root/sign-intermediate"
  }
}

resource "vault_policy" "linkerd_vault_issuer" {
  name   = local.linkerd_vault_issuer
  policy = data.vault_policy_document.linkerd_vault_issuer.hcl
}

resource "vault_kubernetes_auth_backend_role" "linkerd_vault_issuer" {
  bound_service_account_names      = [kubernetes_service_account.linkerd_vault_issuer.metadata[0].name]
  bound_service_account_namespaces = [kubernetes_service_account.linkerd_vault_issuer.metadata[0].namespace]
  audience                         = "vault://${var.cert_manager_namespace}/${local.linkerd_vault_issuer}"
  role_name                        = local.linkerd_vault_issuer
  token_ttl                        = 60
  token_policies                   = [vault_policy.linkerd_vault_issuer.name]
}

resource "kubernetes_manifest" "linkerd_vault_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Issuer"
    metadata = {
      name      = local.linkerd_vault_issuer
      labels    = module.kube_labels.kube_labels
      namespace = var.cert_manager_namespace
    }
    spec = {
      vault = {
        path   = "${var.vault_internal_pki_path}/root/sign-intermediate"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = vault_kubernetes_auth_backend_role.linkerd_vault_issuer.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.linkerd_vault_issuer.metadata[0].name
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_manifest" "linkerd_root_issuer_cert" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.linkerd_root_issuer
      namespace = var.cert_manager_namespace
    }
    spec = {
      secretName = local.linkerd_root_ca_secret
      issuerRef = {
        name = local.linkerd_vault_issuer
        kind = "Issuer"
      }
      commonName = "root.linkerd.cluster.local"
      isCA       = true

      // This MUST be configured this way
      // or linkerd will silently error!
      privateKey = {
        algorithm = "ECDSA"
        size      = 256

        // Don't rotate the private key automatically
        // as this needs to be done manually
        rotationPolicy = "Never"
      }

      usages = [
        "cert sign",
        "crl sign",
        "server auth",
        "client auth"
      ]
    }
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
  depends_on = [kubernetes_manifest.linkerd_vault_issuer]
}

resource "kubernetes_manifest" "linkerd_root_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.linkerd_root_issuer
      labels = module.kube_labels.kube_labels
    }
    spec = {
      ca = {
        secretName = local.linkerd_root_ca_secret
      }
    }
  }
  depends_on = [kubernetes_manifest.linkerd_root_issuer_cert]
}


///////////////////////////////////////////
// Step 2: Create another CA inside of the linkerd
// namespace that will be used to issue identity certificates
// (we just generate the cert and give it to linkerd so it
// can do the generation)
///////////////////////////////////////////

resource "kubernetes_manifest" "linkerd_identity_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.linkerd_identity_issuer
      namespace = local.namespace
    }
    spec = {
      secretName = local.linkerd_identity_ca_secret
      issuerRef = {
        name = local.linkerd_root_issuer
        kind = "ClusterIssuer"
      }
      commonName = "identity.linkerd.cluster.local"
      isCA       = true

      // This MUST be configured this way
      // or linkerd will silently error!
      privateKey = {
        algorithm      = "ECDSA"
        size           = 256
        rotationPolicy = "Always"
      }

      duration    = "48h0m0s"
      renewBefore = "25h0m0s"

      usages = [
        "cert sign",
        "crl sign",
        "server auth",
        "client auth"
      ]
    }
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
  depends_on = [kubernetes_manifest.linkerd_root_issuer]
}

///////////////////////////////////////////
// Step 3: Setup a mechanism to copy
// the CA cert data of the root CAs into the linkerd
// namespace so that linkerd can use them to validate the
// certificates
///////////////////////////////////////////

resource "kubernetes_manifest" "linkerd_bundle" {
  manifest = {
    apiVersion = "trust.cert-manager.io/v1alpha1"
    kind       = "Bundle"
    metadata = {
      name = local.linkerd_root_ca_secret
    }
    spec = {
      sources = [{
        secret = {
          name = local.linkerd_root_ca_secret
          key  = "tls.crt"
        }
      }]
      target = {
        configMap = {
          key = "ca-bundle.crt"
        }
      }
    }
  }
  depends_on = [
    kubernetes_manifest.linkerd_root_issuer
  ]
}

///////////////////////////////////////////
// Step 4: Setup the webhook certs
// based on these docs for automatic rotation:
// https://linkerd.io/2.13/tasks/automatically-rotating-webhook-tls-credentials/
///////////////////////////////////////////

resource "kubernetes_manifest" "linkerd_policy_validator" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.linkerd_policy_validator_webhook_secret
      namespace = local.namespace
    }
    spec = {
      secretName = local.linkerd_policy_validator_webhook_secret
      issuerRef = {
        name = local.linkerd_root_issuer
        kind = "ClusterIssuer"
      }
      commonName = "linkerd-policy-validator.linkerd.svc"
      dnsNames   = ["linkerd-policy-validator.linkerd.svc"]

      privateKey = {
        algorithm      = "ECDSA"
        size           = 256
        encoding       = "PKCS8"
        rotationPolicy = "Always"
      }

      duration    = "24h0m0s"
      renewBefore = "16h0m0s"

      usages = [
        "server auth",
      ]
    }
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
  depends_on = [kubernetes_manifest.linkerd_root_issuer]
}

resource "kubernetes_manifest" "linkerd_proxy_injector" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.linkerd_proxy_injector_webhook_secret
      namespace = local.namespace
    }
    spec = {
      secretName = local.linkerd_proxy_injector_webhook_secret
      issuerRef = {
        name = local.linkerd_root_issuer
        kind = "ClusterIssuer"
      }
      commonName = "linkerd-proxy-injector.linkerd.svc"
      dnsNames   = ["linkerd-proxy-injector.linkerd.svc"]

      privateKey = {
        algorithm      = "ECDSA"
        size           = 256
        rotationPolicy = "Always"
      }

      duration    = "24h0m0s"
      renewBefore = "16h0m0s"

      usages = [
        "server auth",
      ]
    }
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }

  depends_on = [kubernetes_manifest.linkerd_root_issuer]
}

resource "kubernetes_manifest" "linkerd_profile_validator" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "Certificate"
    metadata = {
      name      = local.linkerd_profile_validator_webhook_secret
      namespace = local.namespace
    }
    spec = {
      secretName = local.linkerd_profile_validator_webhook_secret
      issuerRef = {
        name = local.linkerd_root_issuer
        kind = "ClusterIssuer"
      }
      commonName = "linkerd-sp-validator.linkerd.svc"
      dnsNames   = ["linkerd-sp-validator.linkerd.svc"]

      privateKey = {
        algorithm      = "ECDSA"
        size           = 256
        rotationPolicy = "Always"
      }

      duration    = "24h0m0s"
      renewBefore = "16h0m0s"

      usages = [
        "server auth",
      ]
    }
  }
  wait {
    condition {
      type   = "Ready"
      status = "True"
    }
  }
  depends_on = [kubernetes_manifest.linkerd_root_issuer]
}



/***************************************
* Linkerd
***************************************/

resource "helm_release" "linkerd_crds" {
  namespace       = local.namespace
  name            = "linkerd-crds"
  repository      = "https://helm.linkerd.io/stable"
  chart           = "linkerd-crds"
  version         = var.linkerd_crd_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
}

resource "helm_release" "linkerd" {
  namespace       = local.namespace
  name            = "linkerd-control-plane"
  repository      = "https://helm.linkerd.io/stable"
  chart           = "linkerd-control-plane"
  version         = var.linkerd_control_plane_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true

  values = [
    yamlencode({
      controllerLogLevel = "info"

      controllerReplicas        = 2
      enablePodAntiAffinity     = true
      enablePodDisruptionBudget = true

      # Was never able to get the CNI to work.
      # Given the additional downside of this breaking init containers,
      # it's probably for the best to leave it disabled
      cniEnabled = false,

      identity = {
        externalCA = true
        issuer = {
          scheme = "kubernetes.io/tls"
        }
      }

      podLabels = local.linkerd_labels

      priorityClassName = "system-cluster-critical"
      nodeAffinity      = module.constants.controller_node_affinity_helm.nodeAffinity

      policyValidator = {
        externalSecret = true
        injectCaFrom   = "${local.namespace}/${local.linkerd_policy_validator_webhook_secret}"
      }

      profileValidator = {
        externalSecret = true
        injectCaFrom   = "${local.namespace}/${local.linkerd_profile_validator_webhook_secret}"
      }

      proxyInjector = {

        externalSecret = true
        injectCaFrom   = "${local.namespace}/${local.linkerd_proxy_injector_webhook_secret}"

        // We have to manually put this in here
        // b/c for some reason the default helm chart values disallow the sidecar proxy
        // for cert-manager
        namespaceSelector = {
          matchExpressions = [{
            key      = "config.linkerd.io/admission-webhooks"
            operator = "NotIn"
            values   = ["disabled"]
          }]
        }
      }

      // Be default, the init container
      // has way too many resources and ends up
      // utilizing all of the resource request allocations
      // on each node, so we lower them significantly
      // The values selected are the lowest allowable
      // values for VPA measurements; no container
      // on the cluster will EVER get lower values,
      // so no point in going any lower
      proxyInit = {
        resources = {
          cpu = {
            request = "10m"
          }
          memory = {
            request = "10Mi"
            limit   = "10Mi"
          }
        }
      }

    })
  ]

  depends_on = [
    helm_release.linkerd_crds,
    kubernetes_manifest.linkerd_bundle,
    kubernetes_manifest.linkerd_identity_issuer,
    kubernetes_manifest.linkerd_policy_validator,
    kubernetes_manifest.linkerd_proxy_injector,
    kubernetes_manifest.linkerd_profile_validator
  ]
}

resource "kubernetes_manifest" "vpa_identity" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-identity"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "linkerd-identity"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_destination" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-destination"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "linkerd-destination"
      }
    }
  }
}

resource "kubernetes_manifest" "vpa_proxy_injectory" {
  count = var.vpa_enabled ? 1 : 0
  manifest = {
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "linkerd-proxy-injector"
      namespace = local.namespace
      labels    = module.kube_labels.kube_labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "linkerd-proxy-injector"
      }
    }
  }
}
