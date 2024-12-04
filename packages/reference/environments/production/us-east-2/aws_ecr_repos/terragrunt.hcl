include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  ecr_repositories = {
    website              = {}
    scraper              = {}
    demo-user-service    = {}
    demo-tracker-service = {}
    demo-python-service  = {}
    demo-java-service    = {}

    test = {
      expire_all_images = true  # b/c this is only for testing BuildKit functionality
      is_immutable      = false # b/c this is only used for testing BuildKit functionality
    }
    bastion = {
      expire_all_images = true # b/c we copy to the public ecr
    }
    vault = {
      expire_all_images = true # b/c we copy to the public ecr
    }
    panfactum = {
      expire_all_images = true # b/c we copy to the public ecr
    }
    pvc-autoresizer = {
      expire_all_images = true # b/c we copy to the public ecr
    }
    argo-events = {
      expire_all_images = true # b/c we copy to the public ecr
    }
  }
}
