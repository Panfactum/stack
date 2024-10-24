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
    pf = {
      source  = "panfactum/pf"
      version = "0.0.3"
    }
  }
}

module "cdn" {
  source = "../aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name        = var.name
  description = var.description
  domains     = tolist(toset(flatten([for config in var.origin_configs : config.domains])))
  origin_configs = [for config in var.origin_configs : {
    origin_id              = config.origin_id
    origin_domain          = config.origin_domain
    path_prefix            = config.path_prefix
    extra_origin_headers   = config.extra_origin_headers
    default_cache_behavior = lookup(config, "default_cache_behavior", {})
    path_match_behavior    = lookup(config, "path_match_behavior", {})
  }]
  redirect_rules                  = var.redirect_rules
  price_class                     = var.price_class
  cors_enabled                    = var.cors_enabled
  cors_additional_allowed_origins = var.cors_additional_allowed_origins
  cors_allowed_headers            = var.cors_allowed_headers
  cors_allowed_methods            = var.cors_allowed_methods
  cors_max_age_seconds            = var.cors_max_age_seconds
  geo_restriction_type            = var.geo_restriction_type
  geo_restriction_list            = var.geo_restriction_list
  origin_shield_enabled           = var.origin_shield_enabled
  logging_enabled                 = var.logging_enabled
  logging_cookies_enabled         = var.logging_cookies_enabled
  logging_expire_after_days       = var.logging_expire_after_days
}