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
  ci_public_name      = "public"
  ci_internal_name    = "internal"
  ci_internal_ca_name = "internal-ca"
}

module "kube_labels" {
  source = "../kube_labels"

  pf_stack_type    = var.pf_stack_type
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  region           = var.region
  is_local         = var.is_local
  extra_tags       = merge(var.extra_tags)
}

/***************************************
* Cluster Issuer - Public
***************************************/

data "aws_region" "main" {}

data "aws_iam_policy_document" "permissions" {
  statement {
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = [for domain, config in var.route53_zones : config.record_manager_role_arn]
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
        solvers = [for domain, config in var.route53_zones : {
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

resource "vault_mount" "pki_internal" {
  path                      = "pki/internal"
  type                      = "pki"
  description               = "Internal root CA for the ${var.eks_cluster_name} cluster"
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
    labels    = module.kube_labels.kube_labels
  }
}

resource "kubernetes_role" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = var.namespace
    labels    = module.kube_labels.kube_labels
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
    labels    = module.kube_labels.kube_labels
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

resource "vault_policy" "vault_issuer" {
  name   = kubernetes_service_account.vault_issuer.metadata[0].name
  policy = data.vault_policy_document.vault_issuer.hcl
}

resource "vault_kubernetes_auth_backend_role" "vault_issuer" {
  bound_service_account_names      = [kubernetes_service_account.vault_issuer.metadata[0].name]
  bound_service_account_namespaces = [kubernetes_service_account.vault_issuer.metadata[0].namespace]
  audience                         = "vault://${local.ci_internal_name}"
  role_name                        = vault_pki_secret_backend_role.vault_issuer.name
  token_ttl                        = 60
  token_policies                   = [vault_policy.vault_issuer.name]
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

resource "kubernetes_manifest" "internal_ci" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_internal_name
      labels = module.kube_labels.kube_labels
    }
    spec = {
      vault = {
        path   = "${vault_mount.pki_internal.path}/sign/${vault_pki_secret_backend_role.vault_issuer.name}"
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

//////////////////////////////////
/// CA certs
//////////////////////////////////

resource "kubernetes_service_account" "vault_ca_issuer" {
  metadata {
    name      = "vault-ca-issuer"
    namespace = var.namespace
    labels    = module.kube_labels.kube_labels
  }
}

resource "kubernetes_role" "vault_ca_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_ca_issuer.metadata[0].name
    namespace = var.namespace
    labels    = module.kube_labels.kube_labels
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
    labels    = module.kube_labels.kube_labels
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

resource "vault_policy" "vault_ca_issuer" {
  name   = kubernetes_service_account.vault_ca_issuer.metadata[0].name
  policy = data.vault_policy_document.vault_ca_issuer.hcl
}

resource "vault_kubernetes_auth_backend_role" "vault_ca_issuer" {
  bound_service_account_names      = [kubernetes_service_account.vault_ca_issuer.metadata[0].name]
  bound_service_account_namespaces = [kubernetes_service_account.vault_ca_issuer.metadata[0].namespace]
  audience                         = "vault://${local.ci_internal_ca_name}"
  role_name                        = vault_pki_secret_backend_role.vault_ca_issuer.name
  token_ttl                        = 60
  token_policies                   = [vault_policy.vault_ca_issuer.name]
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

resource "kubernetes_manifest" "internal_ca_ci" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name   = local.ci_internal_ca_name
      labels = module.kube_labels.kube_labels
    }
    spec = {
      vault = {
        path   = "${vault_mount.pki_internal.path}/root/sign-intermediate"
        server = var.vault_internal_url
        auth = {
          kubernetes = {
            role      = vault_kubernetes_auth_backend_role.vault_ca_issuer.role_name
            mountPath = "/v1/auth/kubernetes"
            serviceAccountRef = {
              name = kubernetes_service_account.vault_ca_issuer.metadata[0].name
            }
          }
        }
      }
    }
  }
}