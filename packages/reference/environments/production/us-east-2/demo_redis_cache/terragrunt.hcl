include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

inputs = {
  redis_share_creds_admin_secret_destinations = ["demo_user_service"]
}