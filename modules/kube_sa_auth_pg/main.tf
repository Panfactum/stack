terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.22"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.19.0"
    }
  }
}

locals {
  role_name = "pg-auth-${md5("${var.namespace}${var.service_account}${var.database_role}")}"
}

module "constants" {
  source = "../constants"
}

/***************************************
* Main
***************************************/

data "vault_policy_document" "main" {
  rule {
    capabilities = ["read"]
    path         = "db/creds/${var.database_role}"
  }
}

resource "vault_policy" "main" {
  name   = local.role_name
  policy = data.vault_policy_document.main.hcl
}


resource "vault_kubernetes_auth_backend_role" "main" {
  bound_service_account_names      = [var.service_account]
  bound_service_account_namespaces = [var.namespace]
  role_name                        = local.role_name
  token_ttl                        = 60 * 60 * 8
  token_policies                   = [vault_policy.main.name]
  token_bound_cidrs                = ["10.0.0.0/16"] // Only allow this token to be used from inside the cluster
}

resource "kubernetes_manifest" "creds" {
  manifest = {
    apiVersion = "secrets-store.csi.x-k8s.io/v1alpha1"
    kind       = "SecretProviderClass"
    metadata = {
      name      = local.role_name
      namespace = var.namespace
      labels    = var.kube_labels
    }
    spec = {
      provider = "vault"
      parameters = {
        vaultAddress = "http://vault-active.vault.svc.cluster.local:8200"
        roleName     = vault_kubernetes_auth_backend_role.main.role_name
        objects = yamlencode([
          {
            objectName = "password"
            secretPath = "db/creds/${var.database_role}"
            secretKey  = "password"
          },
          {
            objectName = "username"
            secretPath = "db/creds/${var.database_role}"
            secretKey  = "username"
          }
        ])
      }
    }
  }
}
