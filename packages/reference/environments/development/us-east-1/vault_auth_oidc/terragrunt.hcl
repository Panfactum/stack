include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "vault" {
  config_path  = "../kube_vault"
  skip_outputs = true
}

locals {
  secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  client_id          = "06fca533eaee0113"
  client_secret      = local.secrets.vault_sso_client_secret
  oidc_discovery_url = "https://authentik.panfactum.com/application/o/vault-seth/"
  oidc_redirect_uris = [
    "https://vault.seth.panfactum.com/ui/vault/auth/oidc/oidc/callback",
    "https://vault.seth.panfactum.com/oidc/callback",
    "http://localhost:8250/oidc/callback"
  ]
  oidc_issuer = "https://authentik.panfactum.com/application/o/vault-seth/"

  superuser_groups         = ["superusers"]
  admin_groups             = ["privileged_engineers"]
  reader_groups            = ["engineers"]
  restricted_reader_groups = ["restricted_engineers", "demo_users"]
}