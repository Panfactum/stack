include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.source
}

dependency "ingress" {
  config_path  = "../kube_ingress_nginx"
  skip_outputs = true
}

inputs = {
  website_domain         = "panfactum.com"
  website_image_version  = "8310b109f195236791bc72c6654e7a88c6f2802b"
}