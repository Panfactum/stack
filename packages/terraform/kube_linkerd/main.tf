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

  linkerd_root_ca_secret                   = "linkerd-identity-trust-roots" # MUST be named this
  linkerd_root_issuer                      = "linkerd-root-issuer"
  linkerd_identity_issuer                  = "linkerd-identity-issuer"
  linkerd_identity_ca_secret               = "linkerd-identity-issuer"
  linkerd_policy_validator_webhook_secret  = "linkerd-policy-validator-k8s-tls" # MUST be named this
  linkerd_proxy_injector_webhook_secret    = "linkerd-proxy-injector-k8s-tls"   # MUST be named this
  linkerd_profile_validator_webhook_secret = "linkerd-sp-validator-k8s-tls"     # MUST be named this
}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = var.extra_tags
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
* Linkerd Certs
***************************************/

///////////////////////////////////////////
// Step 1: Create a CA inside of the linkerd
// namespace that will be used to issue identity certificates
// (we just generate the cert and give it to linkerd so it
// can do the generation)
///////////////////////////////////////////

module "linkerd_identity_issuer" {
  source = "../kube_internal_cert"

  secret_name = local.linkerd_identity_issuer
  common_name = "identity.linkerd.cluster.local"
  namespace   = local.namespace
  is_ca       = true
  usages = [
    "cert sign",
    "crl sign",
    "server auth",
    "client auth"
  ]
  duration     = "2160h0m0s"
  renew_before = "1680h0m0s"

  environment = var.environment
  region      = var.region
  extra_tags  = var.extra_tags
}

///////////////////////////////////////////
// Step 2: Setup a mechanism to copy
// the CA cert data of the root Vault CA into all namespaces
// so that linkerd can use them to validate the
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
        inLine = var.vault_ca_crt
      }]
      target = {
        configMap = {
          key = "ca-bundle.crt"
        }
      }
    }
  }
}

///////////////////////////////////////////
// Step 3: Setup the webhook certs
// based on these docs for automatic rotation:
// https://linkerd.io/2.13/tasks/automatically-rotating-webhook-tls-credentials/
///////////////////////////////////////////

module "linkerd_policy_validator" {
  source = "../kube_internal_cert"

  secret_name          = local.linkerd_policy_validator_webhook_secret
  service_names        = ["linkerd-policy-validator"]
  namespace            = local.namespace
  private_key_encoding = "PKCS8" // It must be this encoding
  duration             = "2160h0m0s"
  renew_before         = "1680h0m0s"

  environment = var.environment
  region      = var.region
  extra_tags  = var.extra_tags
}



module "linkerd_proxy_injector" {
  source = "../kube_internal_cert"

  secret_name   = local.linkerd_proxy_injector_webhook_secret
  service_names = ["linkerd-proxy-injector"]
  namespace     = local.namespace
  duration      = "2160h0m0s"
  renew_before  = "1680h0m0s"

  environment = var.environment
  region      = var.region
  extra_tags  = var.extra_tags
}


module "linkerd_profile_validator" {
  source = "../kube_internal_cert"

  secret_name   = local.linkerd_profile_validator_webhook_secret
  service_names = ["linkerd-sp-validator"]
  namespace     = local.namespace
  duration      = "2160h0m0s"
  renew_before  = "1680h0m0s"

  environment = var.environment
  region      = var.region
  extra_tags  = var.extra_tags
}



/***************************************
* Linkerd
***************************************/

resource "helm_release" "linkerd_crds" {
  namespace       = local.namespace
  name            = "linkerd-crds"
  repository      = "https://helm.linkerd.io/edge"
  chart           = "linkerd-crds"
  version         = var.linkerd_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
}

resource "helm_release" "linkerd" {
  namespace       = local.namespace
  name            = "linkerd-control-plane"
  repository      = "https://helm.linkerd.io/edge"
  chart           = "linkerd-control-plane"
  version         = var.linkerd_helm_version
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

      podLabels = module.kube_labels.kube_labels

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
    module.linkerd_policy_validator,
    module.linkerd_proxy_injector,
    module.linkerd_identity_issuer,
    module.linkerd_profile_validator
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
