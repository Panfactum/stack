include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "authentik_core" {
  config_path = "../authentik_core_resources"
}

dependency "kube_authentik" {
  config_path = "../kube_authentik"
}

dependency "authentik_atlas_mongodb_sso" {
  config_path = "../authentik_mongodb_atlas_sso"
}

locals {
  #secrets = yamldecode(sops_decrypt_file("${get_terragrunt_dir()}/secrets.yaml"))
}

inputs = {
  /*mongodbatlas_public_key = local.secrets.public_key
  mongodbatlas_private_key = local.secrets.private_key*/

  federation_settings_id = "679ac90e37161e292db2780e"
  idp_id = "67a80b37499ddf3676fa8f2b"
  organization_id = "679ac9030691076f53402259"

  issuer_url = dependency.kube_authentik.outputs.authentik_url
  sso_url = dependency.authentik_atlas_mongodb_sso.outputs.url_sso_post

  associated_domains = ["panfactum.com"]
  active = true
}