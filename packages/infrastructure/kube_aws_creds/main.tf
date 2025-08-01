terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.80.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.34.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.1.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.7"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "4.5.0"
    }
  }
}

data "pf_aws_tags" "tags" {
  module = "kube_aws_creds"
}

data "pf_kube_labels" "labels" {
  module = "kube_aws_creds"
}

/***************************************
* IAM User Configuration
***************************************/

resource "random_id" "user" {
  prefix      = "vault-"
  byte_length = 8
}

resource "aws_iam_user" "user" {
  name = random_id.user.hex
}

resource "aws_iam_user_policy" "user" {
  policy = coalesce(var.iam_policy_json, "{}")
  user   = aws_iam_user.user.name
}

resource "aws_iam_user_policy_attachment" "user" {
  for_each = toset(var.iam_policy_arns)

  policy_arn = each.key
  user       = aws_iam_user.user.name
}

resource "vault_aws_secret_backend_static_role" "role" {
  backend         = "aws"
  name            = aws_iam_user.user.name
  username        = aws_iam_user.user.name
  rotation_period = var.credential_lifetime_hours * 60 * 60
}

/***************************************
* Creds Generation
***************************************/

data "vault_policy_document" "vault_secrets" {
  rule {
    path         = "aws/static-creds/${vault_aws_secret_backend_static_role.role.name}"
    capabilities = ["read", "list"]
    description  = "Allows getting IAM user credentials"
  }
}

resource "kubernetes_service_account" "vault" {
  metadata {
    name      = random_id.user.hex
    namespace = var.namespace
    labels    = data.pf_kube_labels.labels.labels
  }
}

module "vault_auth_vault_secrets" {
  source                    = "../kube_sa_auth_vault"
  service_account           = kubernetes_service_account.vault.metadata[0].name
  service_account_namespace = var.namespace
  vault_policy_hcl          = data.vault_policy_document.vault_secrets.hcl
  audience                  = "vault"
}

resource "kubectl_manifest" "vault_connection" {
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultConnection"
    metadata = {
      name      = random_id.user.hex
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      address = "http://vault-active.vault.svc.cluster.local:8200"
    }
  })
  force_conflicts   = true
  server_side_apply = true
}

resource "kubectl_manifest" "vault_auth" {
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultAuth"
    metadata = {
      name      = random_id.user.hex
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      vaultConnectionRef = random_id.user.hex
      method             = "kubernetes"
      mount              = "kubernetes"
      allowedNamespaces  = [var.namespace]
      kubernetes = {
        role           = module.vault_auth_vault_secrets.role_name
        serviceAccount = random_id.user.hex
        audiences      = ["vault"]
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on = [
    vault_aws_secret_backend_static_role.role,
    kubernetes_service_account.vault,
    kubectl_manifest.vault_connection
  ]
}

resource "kubectl_manifest" "vault_secrets" {
  yaml_body = yamlencode({
    apiVersion = "secrets.hashicorp.com/v1beta1"
    kind       = "VaultDynamicSecret"
    metadata = {
      name      = "${random_id.user.hex}-creds"
      namespace = var.namespace
      labels    = data.pf_kube_labels.labels.labels
    }
    spec = {
      vaultAuthRef   = random_id.user.hex
      mount          = "aws"
      path           = "static-creds/${vault_aws_secret_backend_static_role.role.name}"
      renewalPercent = 50
      destination = {
        create = true
        name   = "${random_id.user.hex}-creds"
        transformation = {
          excludes = [".*"]
          templates = {
            AWS_ACCESS_KEY_ID = {
              text = "{{(get .Secrets \"access_key\")}}"
            }
            AWS_SECRET_ACCESS_KEY = {
              text = "{{(get .Secrets \"secret_key\")}}"
            }
          }
        }
      }
    }
  })
  force_conflicts   = true
  server_side_apply = true
  depends_on        = [kubectl_manifest.vault_auth]
}