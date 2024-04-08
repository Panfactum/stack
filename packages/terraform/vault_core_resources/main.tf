// Live

terraform {
  required_providers {
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.10.0"
    }
  }
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


