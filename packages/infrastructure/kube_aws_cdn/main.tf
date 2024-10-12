terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.0"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.70.0"
      configuration_aliases = [aws.global]
    }
    archive = {
      source  = "hashicorp/archive"
      version = "2.6.0"
    }
  }
}

module "cdn" {
  source = "../aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name    = var.name
  domains = tolist(toset(flatten([for config in var.origin_configs : config.domains])))
  origin_configs = [for config in var.origin_configs : {
    origin_id              = config.origin_id
    origin_domain          = config.origin_domain
    path_prefix            = config.path_prefix
    extra_origin_headers   = config.extra_origin_headers
    default_cache_behavior = lookup(config, "default_cache_behavior", {})
    path_match_behavior    = lookup(config, "path_match_behavior", {})
  }]
  redirect_rules        = var.redirect_rules
  price_class           = var.price_class
  geo_restriction_type  = var.geo_restriction_type
  geo_restriction_list  = var.geo_restriction_list
  origin_shield_enabled = var.origin_shield_enabled

  # pf-generate: pass_vars
  pf_stack_version = var.pf_stack_version
  pf_stack_commit  = var.pf_stack_commit
  environment      = var.environment
  region           = var.region
  pf_root_module   = var.pf_root_module
  is_local         = var.is_local
  extra_tags       = var.extra_tags
  # end-generate
}