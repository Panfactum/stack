include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "authentik_atlas_mongodb_sso" {
  config_path = "../authentik_mongodb_atlas_sso"
}

inputs = {
  federation_settings_id = "679ac90e37161e292db2780e"
  idp_id                 = "67a80b37499ddf3676fa8f2b"
  organization_id        = "679ac9030691076f53402259"

  issuer_url = dependency.authentik_atlas_mongodb_sso.outputs.issuer_url
  sso_url    = dependency.authentik_atlas_mongodb_sso.outputs.url_sso_post

  associated_domains = ["panfactum.com"]
  sso_debug_enabled  = false # set this to true while setting up the integration for the first time
}