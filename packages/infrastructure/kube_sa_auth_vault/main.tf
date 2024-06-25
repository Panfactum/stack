terraform {
  required_providers {
    vault = {
      source  = "hashicorp/vault"
      version = "3.25.0"
    }
  }
}

locals {}

# ################################################################################
# Role Setup
# ################################################################################

resource "vault_policy" "policy" {
  name   = "${var.service_account_namespace}-${var.service_account}"
  policy =var.vault_policy_hcl
}

resource "vault_kubernetes_auth_backend_role" "role" {
  bound_service_account_names      = [var.service_account]
  bound_service_account_namespaces = [var.service_account_namespace]
  role_name                        = "${var.service_account_namespace}-${var.service_account}"
  token_ttl                        = var.token_ttl_seconds
  token_max_ttl = var.token_ttl_seconds
  token_policies                   = [vault_policy.policy.name]
  audience = var.audience

  # Vault tokens generated from ServiceAccounts can only be used inside the private network
  # of the cluster to prevent token exfiltration
  token_bound_cidrs = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16"
  ]
}

