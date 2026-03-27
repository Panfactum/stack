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

dependency "vault_sso" {
  config_path = "../authentik_vault_sso_production"
}

inputs = {
  client_id          = dependency.vault_sso.outputs.client_id
  client_secret      = dependency.vault_sso.outputs.client_secret
  oidc_discovery_url = dependency.vault_sso.outputs.oidc_discovery_url
  oidc_redirect_uris = dependency.vault_sso.outputs.oidc_redirect_uris
  oidc_issuer        = dependency.vault_sso.outputs.oidc_issuer

  superuser_groups         = ["superusers"]
  admin_groups             = ["privileged_engineers"]
  reader_groups            = ["engineers"]
  restricted_reader_groups = ["restricted_engineers", "demo_users"]
}

