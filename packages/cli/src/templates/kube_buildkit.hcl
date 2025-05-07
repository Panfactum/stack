include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "kyverno" {
  config_path  = "../kube_kyverno"
  skip_outputs = true
}

inputs = {}

# so buildkit issue doesn't hang ci
exclude {
  # Skip during CI but not completely exclude
  if = get_env("CI", "false") == "true"

  # Exclude from all actions except output requests
  actions = ["all_except_output"]

  # Don't exclude dependencies
  exclude_dependencies = false
}