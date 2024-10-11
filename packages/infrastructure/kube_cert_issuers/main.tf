// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.70.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "2.0.4"
    }
  }
}

locals {
  ci_public_name      = "public"
  ci_internal_name    = "internal"
  ci_internal_ca_name = "internal-ca"

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
}

module "util" {
  source = "../kube_workload_utility"

  # pf-generate: set_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  pf_module        = var.pf_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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
  count = length(var.route53_zones) > 0 ? 1 : 0

  source                    = "../kube_sa_auth_aws"
  service_account           = var.service_account
  service_account_namespace = var.namespace
  eks_cluster_name          = var.eks_cluster_name
  iam_policy_json           = data.aws_iam_policy_document.permissions.json
  ip_allow_list             = var.aws_iam_ip_allow_list

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
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
      labels = module.util.labels
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
    labels    = module.util.labels
  }
}

resource "kubernetes_role" "vault_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_issuer.metadata[0].name
    namespace = var.namespace
    labels    = module.util.labels
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
    labels    = module.util.labels
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
      labels = module.util.labels
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
}

# Make sure this CA data is available in all namespaces for mTLS
resource "kubernetes_config_map" "ca_bundle" {
  metadata {
    name      = "internal-ca"
    labels    = module.util.labels
    namespace = var.namespace
    annotations = {
      "reflector.v1.k8s.emberstack.com/reflection-auto-enabled" = "true"
      "reflector.v1.k8s.emberstack.com/reflection-allowed"      = "true"
    }
  }
  data = {
    "ca.crt" = vault_pki_secret_backend_root_cert.pki_internal.issuing_ca
  }
}

//////////////////////////////////
/// CA certs
//////////////////////////////////

resource "kubernetes_service_account" "vault_ca_issuer" {
  metadata {
    name      = "vault-ca-issuer"
    namespace = var.namespace
    labels    = module.util.labels
  }
}

resource "kubernetes_role" "vault_ca_issuer" {
  metadata {
    name      = kubernetes_service_account.vault_ca_issuer.metadata[0].name
    namespace = var.namespace
    labels    = module.util.labels
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
    labels    = module.util.labels
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
      labels = module.util.labels
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
}
