terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.global]
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

data "aws_caller_identity" "main" {}

data "pf_aws_tags" "tags" {
  module = "aws_s3_public_website"
}

///////////////////////////////////////////////
// S3 Bucket
///////////////////////////////////////////////

resource "aws_cloudfront_origin_access_control" "cf_oac" {
  name                              = var.bucket_name
  description                       = "Restricts access to AWS S3 content in ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "cf_access" {
  statement {
    sid    = "CloudFrontAccess"
    effect = "Allow"
    principals {
      identifiers = ["cloudfront.amazonaws.com"]
      type        = "Service"
    }
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.bucket_name}/*"]
    condition {
      test     = "StringEquals"
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.main.account_id}:distribution/${module.cf.distribution_id}"]
      variable = "AWS:SourceArn"
    }
  }
}

module "bucket" {
  source = "../aws_s3_private_bucket"

  bucket_name   = var.bucket_name
  description   = var.description
  access_policy = data.aws_iam_policy_document.cf_access.json
}

resource "aws_s3_bucket_cors_configuration" "bucket" {
  bucket = module.bucket.bucket_name
  cors_rule {
    allowed_headers = var.cors_allowed_headers
    allowed_methods = ["GET"]
    allowed_origins = concat(["https://${var.domain}"], var.cors_additional_allowed_origins)
    max_age_seconds = var.cors_max_age_seconds
    expose_headers  = var.cors_expose_headers
  }
}

///////////////////////////////////////////////
// Cloudfront Distribution
///////////////////////////////////////////////

module "cf" {
  source = "../aws_cdn"
  providers = {
    aws.global = aws.global
  }

  name = var.bucket_name

  domains = [var.domain]

  origin_configs = [
    {
      path_prefix = "" // This must be set to "" and not "/" in order to implement the regex logic without running into eval errors in the cloudfront function execution environment
      origin_domain            = module.bucket.regional_domain_name
      origin_access_control_id = aws_cloudfront_origin_access_control.cf_oac.id

      rewrite_rules = concat(
        var.default_file != "" ? [
          {
            match   = "^/$"
            rewrite = "/${var.default_file}"
          },
          {
            match   = var.default_file_strict ? "^([^.]*[^./])/?$" : "^(.*[^/])/$"
            rewrite = "$1/${var.default_file}"
          }
        ] : [],
        var.rewrite_rules
      )
    }
  ]

  cors_enabled                    = true
  cors_allowed_headers            = var.cors_allowed_headers
  cors_allowed_methods            = var.cors_allowed_methods
  cors_max_age_seconds            = var.cors_max_age_seconds
  cors_additional_allowed_origins = var.cors_additional_allowed_origins

  origin_shield_enabled = true
  price_class           = var.price_class

  logging_enabled           = var.logging_enabled
  logging_cookies_enabled   = var.logging_cookies_enabled
  logging_expire_after_days = var.logging_expire_after_days

  geo_restriction_type = var.geo_restriction_type
  geo_restriction_list = var.geo_restriction_list
}
