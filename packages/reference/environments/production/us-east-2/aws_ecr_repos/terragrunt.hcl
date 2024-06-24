include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  ecr_repositories = {
    website = {}
    bastion = {
      expire_all_images = true # b/c we copy to the public ecr
    }
    panfactum = {
      expire_all_images = true # b/c we copy to the public ecr
    }
  }
}
