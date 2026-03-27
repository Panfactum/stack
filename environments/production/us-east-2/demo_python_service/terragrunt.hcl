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
  namespace = "demo-python-service"

  domain               = "demo.panfactum.com"
  image_version        = run_cmd("--terragrunt-quiet", "pf-get-commit-hash", "--ref=main", "--repo=https://github.com/panfactum/reference-infrastructure")
  healthcheck_route    = "/health"
  db_name              = "postgres"
  db_schema            = "public"
  token_validation_url = "http://demo-user-service.demo-user-service:3000/validate"
}