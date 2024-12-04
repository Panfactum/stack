include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

inputs = {
  ecr_repositories = {
    panfactum = {

    }
    bastion = {

    }
    pvc-autoresizer = {

    }
    argo-events = {

    }
    vault = {

    }
  }
}
