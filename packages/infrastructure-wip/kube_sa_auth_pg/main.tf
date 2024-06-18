terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

locals {
  role_name = "pg-auth-${md5("${var.namespace}${var.service_account}${var.database_role}")}"
}

module "kube_labels" {
  source = "../kube_labels"

  # generate: common_vars.snippet.txt
variable "environment" {
  description = "The name of the environment the infrastructure is being deployed into. #injected"
  type        = string
  default     = null
}

variable "pf_root_module" {
  description = "The name of the root Panfactum module in the module tree. #injected"
  type        = string
  default     = "kube_sa_auth_pg"
}

variable "pf_module" {
  description = "The name of the Panfactum module where the containing resources are directly defined. #injected"
  type        = string
  default     = "kube_sa_auth_pg"
}

variable "region" {
  description = "The region the infrastructure is being deployed into. #injected"
  type        = string
  default     = null
}

variable "extra_tags" {
  description = "Extra tags or labels to add to the created resources. #injected"
  type        = map(string)
  default     = {}
}

variable "is_local" {
  description = "Whether this module is a part of a local development deployment #injected"
  type        = bool
  default     = false
}

variable "pf_stack_version" {
  description = "Which version of the Panfactum stack is being used (git ref) #injected"
  type        = string
  default     = "main"
}

variable "pf_stack_commit" {
  description = "The commit hash for the version of the Panfactum stack being used #injected"
  type        = string
  default     = "xxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
  # end-generate
}

module "constants" {
  source = "../constants"

  # generate: common_vars.snippet.txt
variable "environment" {
  description = "The name of the environment the infrastructure is being deployed into. #injected"
  type        = string
  default     = null
}

variable "pf_root_module" {
  description = "The name of the root Panfactum module in the module tree. #injected"
  type        = string
  default     = "kube_sa_auth_pg"
}

variable "pf_module" {
  description = "The name of the Panfactum module where the containing resources are directly defined. #injected"
  type        = string
  default     = "kube_sa_auth_pg"
}

variable "region" {
  description = "The region the infrastructure is being deployed into. #injected"
  type        = string
  default     = null
}

variable "extra_tags" {
  description = "Extra tags or labels to add to the created resources. #injected"
  type        = map(string)
  default     = {}
}

variable "is_local" {
  description = "Whether this module is a part of a local development deployment #injected"
  type        = bool
  default     = false
}

variable "pf_stack_version" {
  description = "Which version of the Panfactum stack is being used (git ref) #injected"
  type        = string
  default     = "main"
}

variable "pf_stack_commit" {
  description = "The commit hash for the version of the Panfactum stack being used #injected"
  type        = string
  default     = "xxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
  # end-generate
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
      labels    = module.kube_labels.kube_labels
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
