// Live

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.27.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "5.39.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
  }
}

data "aws_region" "region" {}
data "aws_caller_identity" "id" {}

locals {
  redirect_uris = [
    "http://localhost:8250/oidc/callback",              // CLI
    "${var.vault_url}/ui/vault/auth/oidc/oidc/callback" // Web
  ]
}

/***************************************
* Setup Vault for User Auth
***************************************/

data "vault_policy_document" "admins" {
  rule {
    path         = "secret/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allow all on secrets"
  }
  rule {
    path         = "auth/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allow all on auth"
  }
  rule {
    path         = "sys/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allow all on sys"
  }
  rule {
    path         = "identity/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allow all on identity"
  }
  rule {
    path         = "pki/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allow all on pki infrastructure"
  }
  rule {
    path         = "db/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allow all on db infrastructure"
  }
  rule {
    path         = "transit/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allows interacting with the transit secrets engine"
  }
  rule {
    path         = "ssh/*"
    capabilities = ["create", "read", "update", "delete", "list"]
    description  = "allows management of ssh signing for bastion authentication"
  }
}

resource "vault_policy" "admins" {
  name   = "admin"
  policy = data.vault_policy_document.admins.hcl
}

data "vault_policy_document" "readers" {
  rule {
    path         = "secret/*"
    capabilities = ["read", "list"]
    description  = "allow read on secrets"
  }
  rule {
    path         = "auth/*"
    capabilities = ["read", "list"]
    description  = "allow read on auth"
  }
  rule {
    path         = "identity/*"
    capabilities = ["read", "list"]
    description  = "allow read on identity"
  }
  rule {
    path         = "pki/*"
    capabilities = ["read", "list"]
    description  = "allow read on pki infrastructure"
  }
  rule {
    path         = "db/creds/reader*"
    capabilities = ["read", "list"]
    description  = "allows getting credentials for read-only database roles"
  }
  rule {
    path         = "ssh/*"
    capabilities = ["read", "list"]
    description  = "allows getting ssh keys signed for bastion authentication"
  }
}

resource "vault_policy" "readers" {
  name   = "reader"
  policy = data.vault_policy_document.readers.hcl
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
* Setup AWS Secrets Engine
***************************************/

# TODO: We will use this for generating CICD credentials

/***************************************
* Internal cluster PKI CA
***************************************/

resource "vault_mount" "pki_internal" {
  path                      = "pki/internal"
  type                      = "pki"
  description               = "Internal root CA for the cluster"
  default_lease_ttl_seconds = 60 * 60 * 24
  max_lease_ttl_seconds     = 60 * 60 * 24 * 365 * 10
}

resource "vault_pki_secret_backend_root_cert" "pki_internal" {
  backend              = vault_mount.pki_internal.path
  type                 = "internal"
  common_name          = "http://vault.vault.svc.cluster.local:8200"
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

/***************************************
* Database Secrets Backend
***************************************/

resource "vault_mount" "db" {
  path = "db"
  type = "database"
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
* SSH Signing (Bastion Authentication)
***************************************/

resource "vault_mount" "ssh" {
  path                      = "ssh"
  type                      = "ssh"
  description               = "Configured to sign ssh keys for bastion authentication"
  default_lease_ttl_seconds = var.ssh_cert_lifetime_seconds
  max_lease_ttl_seconds     = var.ssh_cert_lifetime_seconds
}

resource "vault_ssh_secret_backend_ca" "ssh" {
  backend              = vault_mount.ssh.path
  generate_signing_key = true
}

resource "vault_ssh_secret_backend_role" "ssh" {
  backend  = vault_mount.ssh.path
  key_type = "ca"
  name     = "default"

  // For users, not hosts
  allow_user_certificates = true
  allow_host_certificates = false

  // Only allow high security ciphers
  algorithm_signer = "rsa-sha2-512"
  allowed_user_key_config {
    lengths = [0]
    type    = "ed25519"
  }

  // We only do port forwarding through the bastions
  default_extensions = {
    permit-port-forwarding = ""
  }
  allowed_extensions = "permit-port-forwarding"

  // Everyone must login with the panfactum user
  allowed_users = "panfactum"
  default_user  = "panfactum"

  // They are only valid for a single day
  ttl     = var.ssh_cert_lifetime_seconds
  max_ttl = var.ssh_cert_lifetime_seconds
}


