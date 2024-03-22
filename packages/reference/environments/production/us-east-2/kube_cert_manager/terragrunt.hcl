include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = "github.com/Panfactum/stack.git?ref=main/packages/terraform//kube_cert_manager"
}

dependency "cilium" {
  config_path  = "../kube_cilium"
  skip_outputs = true
}

inputs = {
  self_generated_certs_enabled = false
  vpa_enabled                  = false
}
