include "panfactum" {
  path   = find_in_parent_folders("panfactum.hcl")
  expose = true
}

terraform {
  source = include.panfactum.locals.pf_stack_source
}

dependency "aws_vpc" {
  config_path = "../aws_vpc"
}

inputs = {
  domain = "panfactum.com"
  smtp_allowed_cidrs = concat(
    [dependency.aws_vpc.outputs.vpc_cidr],
    dependency.aws_vpc.outputs.nat_ips
  )
}
