// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

locals {

  service = "cert-manager"

  ci_public_name   = "public"
  ci_internal_name = "internal"

}

module "kube_labels" {
  source         = "../kube_labels"
  environment    = var.environment
  pf_root_module = var.pf_root_module
  pf_module      = var.pf_module
  region         = var.region
  is_local       = var.is_local
  extra_tags     = merge(var.extra_tags, { service = local.service })
}

/***************************************
* Cluster Issuer - Public
***************************************/

data "aws_region" "main" {}

data "aws_iam_policy_document" "permissions" {
  statement {
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = [for domain, config in var.dns_zones : config.record_manager_role_arn]
  }
}

module "aws_permissions" {
  source                    = "../kube_sa_auth_aws"
  service_account           = var.service_account
  service_account_namespace = var.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.permissions.json
  ip_allow_list             = var.ip_allow_list
  environment               = var.environment
  pf_root_module            = var.pf_root_module
  region                    = var.region
  is_local                  = var.is_local
  extra_tags                = var.extra_tags
}

// the default issuer for PUBLIC tls certs in the default DNS zone for the env
resource "kubernetes_manifest" "cluster_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_public_name
      labels = module.kube_labels.kube_labels
    }
    spec = {
      acme = {
        email  = var.alert_email
        server = "https://acme-v02.api.letsencrypt.org/directory"
        privateKeySecretRef = {
          name = "letsencrypt-cert-key"
        }
        solvers = [for domain, config in var.dns_zones : {
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
        }]
      }
    }
  }
}

/***************************************
* Cluster Issuer - Internal
***************************************/

resource "kubernetes_service_account" "vault_issuer" {
  metadata {
    name      = "vault-issuer"
    namespace = var.namespace
    // TODO: Labels
  }
}

resource "kubernetes_role" "vault_issuer" {
  metadata {
    name      = "vault-issuer"
    namespace = var.namespace
    // TODO: Labels
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
    name      = "vault-issuer"
    namespace = var.namespace
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
    path         = "${var.vault_internal_pki_path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
  }
}

resource "vault_policy" "vault_issuer" {
  name   = "vault-issuer"
  policy = data.vault_policy_document.vault_issuer.hcl
}

resource "vault_kubernetes_auth_backend_role" "vault_issuer" {
  bound_service_account_names      = [kubernetes_service_account.vault_issuer.metadata[0].name]
  bound_service_account_namespaces = [kubernetes_service_account.vault_issuer.metadata[0].namespace]
  audience                         = "vault://${local.ci_internal_name}"
  role_name                        = "vault-issuer"
  token_ttl                        = 60
  token_policies                   = [vault_policy.vault_issuer.name]
}

resource "vault_pki_secret_backend_role" "vault_issuer" {
  backend = var.vault_internal_pki_path
  name    = "vault-issuer"

  // This is super permissive b/c these certificates are only used for
  // internal traffic encryption
  allow_any_name              = true
  allow_wildcard_certificates = true
  enforce_hostnames           = false
  allow_ip_sans               = true
  require_cn                  = false

  key_type = "ec"
  key_bits = 256

  max_ttl = 60 * 60 * 48 // Internal certs need to be rotated regularly
}

resource "kubernetes_manifest" "internal_ca" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_internal_name
      labels = module.kube_labels.kube_labels
    }
    spec = {
      vault = {
        path   = "${var.vault_internal_pki_path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = vault_kubernetes_auth_backend_role.vault_issuer.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.vault_issuer.metadata[0].name
            }
          }
        }
      }
    }
  }
}
