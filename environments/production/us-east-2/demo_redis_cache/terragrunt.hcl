include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

inputs = {
  redis_share_creds_secret_destinations = ["demo-user-service"]
}