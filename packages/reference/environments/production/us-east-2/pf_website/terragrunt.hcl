include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "ingress" {
  config_path  = "../kube_ingress_nginx"
  skip_outputs = true
}

inputs = {
  website_domain        = "panfactum.com"
  website_image_version = yamldecode(file("${get_terragrunt_dir()}/version.yaml")).version
  vpa_enabled           = true
}


