terraform {
  required_providers {
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

locals {
  namespace                              = "vault"
  vault_secrets_operator_service_account = "vault-secrets-operator-controller-manager"
}

data "pf_kube_labels" "labels" {
  module = "vault_core_resources"
}

/***************************************
* Setup Authentication via Kubernetes
***************************************/
resource "vault_auth_backend" "kubernetes" {
  type = "kubernetes"
}

resource "vault_kubernetes_auth_backend_config" "kubernetes" {
  backend         = vault_auth_backend.kubernetes.path
  kubernetes_host = var.kubernetes_url
}

/***************************************
* Database Secrets Backend
***************************************/

resource "vault_mount" "db" {
  path = "db"
  type = "database"
}

/***************************************
* NATS Secrets Backend
***************************************/

resource "vault_plugin" "nats" {
  type    = "secret"
  name    = "nats-secrets"
  version = "v1.7.0"
  command = "vault-plugin-secrets-nats"
  sha256  = "8b7878dfe31f86c332d95a21a4e34ae64782545ee4e5ff98c68518a1dcb560c2"
}

resource "vault_mount" "nats" {
  type                      = vault_plugin.nats.name
  path                      = "nats"
  seal_wrap                 = true
  default_lease_ttl_seconds = 60 * 60 * 8
  max_lease_ttl_seconds     = 60 * 60 * 8
}

/***************************************
* Vault Transit Encryption
***************************************/

resource "vault_mount" "transit" {
  path                      = "transit"
  type                      = "transit"
  description               = "Configured to allow vault to act as a kms"
  default_lease_ttl_seconds = 60 * 60 * 24
  max_lease_ttl_seconds     = 60 * 60 * 24
}

/***************************************
* Vault Secrets Operator
***************************************/

resource "vault_transit_secret_backend_key" "secrets_operator" {
  backend          = vault_mount.transit.path
  name             = "vault-secrets-operator"
  exportable       = false
  deletion_allowed = true
  derived          = false
}


resource "vault_transit_secret_cache_config" "secrets_operator" {
  backend = vault_mount.transit.path
  size    = 500
}

data "vault_policy_document" "vault_secrets_operator" {
  rule {
    path         = "${vault_mount.transit.path}/encrypt/${vault_transit_secret_backend_key.secrets_operator.name}"
    capabilities = ["create", "update"]
    description  = "encrypt"
  }
  rule {
    path         = "${vault_mount.transit.path}/decrypt/${vault_transit_secret_backend_key.secrets_operator.name}"
    capabilities = ["create", "update"]
    description  = "decrypt"
  }
}

module "vault_auth_vault_secrets_operator" {
  source = "../kube_sa_auth_vault"

  service_account           = local.vault_secrets_operator_service_account
  service_account_namespace = local.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_secrets_operator.hcl
  audience                  = "vault"
}

module "util_secrets_operator" {
  source = "../kube_workload_utility"

  workload_name                        = "vault-secrets-operator"
  burstable_nodes_enabled              = true
  arm_nodes_enabled                    = true
  controller_nodes_enabled             = true
  instance_type_anti_affinity_required = false // single replica
  az_spread_preferred                  = false // single replica
  extra_labels                         = data.pf_kube_labels.labels.labels
}

resource "helm_release" "vault_secrets_operator" {
  namespace       = local.namespace
  name            = "vault-secrets-operator"
  repository      = "https://helm.releases.hashicorp.com"
  chart           = "vault-secrets-operator"
  version         = var.vault_secrets_operator_helm_version
  recreate_pods   = false
  cleanup_on_fail = true
  wait            = true
  wait_for_jobs   = true
  max_history     = 5

  values = [
    yamlencode({
      controller = {
        tolerations = module.util_secrets_operator.tolerations
        affinity    = module.util_secrets_operator.affinity
        manager = {
          logging = {
            level = var.log_level
          }
          clientCache = {
            persistenceModel = "direct-encrypted"
            storageEncryption = {
              enabled      = true
              transitMount = vault_mount.transit.path
              keyName      = vault_transit_secret_backend_key.secrets_operator.name
              namespace    = local.namespace
              method       = "kubernetes"
              mount        = vault_auth_backend.kubernetes.path
              kubernetes = {
                role           = module.vault_auth_vault_secrets_operator.role_name
                serviceAccount = local.vault_secrets_operator_service_account
                tokenAudiences = ["vault"]
              }
            }
          }
          terminationGracePeriodSeconds = 90
          preDeleteHookTimeoutSeconds   = 90
        }
      }

      defaultAuthMethod = {
        enabled   = true
        namespace = local.namespace
        method    = "kubernetes"
        mount     = vault_auth_backend.kubernetes.path
      }
      defaultVaultConnection = {
        enabled = true
        address = "http://vault-active.vault.svc.cluster.local:8200"
      }
    })
  ]
}

resource "kubectl_manifest" "vpa_secrets_operator" {
  count = var.vpa_enabled ? 1 : 0
  yaml_body = yamlencode({
    apiVersion = "autoscaling.k8s.io/v1"
    kind       = "VerticalPodAutoscaler"
    metadata = {
      name      = "vault-secrets-operator"
      namespace = local.namespace
      labels    = module.util_secrets_operator.labels
    }
    spec = {
      targetRef = {
        apiVersion = "apps/v1"
        kind       = "Deployment"
        name       = "vault-secrets-operator-controller-manager"
      }
    }
  })
  server_side_apply = true
  force_conflicts   = true
  depends_on        = [helm_release.vault_secrets_operator]
}

