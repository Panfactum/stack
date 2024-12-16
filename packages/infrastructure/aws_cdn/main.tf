terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "3.6.3"
    }
    aws = {
      source                = "hashicorp/aws"
      version               = "5.80.0"
      configuration_aliases = [aws.global]
    }
    pf = {
      source  = "panfactum/pf"
      version = "0.0.5"
    }
  }
}

data "pf_aws_tags" "tags" {
  module = "aws_cdn"
}

locals {

  // This maps domain names to the zone id of the zone hosting records for the nearest ancestor domain. This is
  // the zone where the CDN cert DNS verification records need to go.
  domain_to_zone_candidates                 = { for domain in var.domains : domain => [for zone in data.aws_route53_zone.zones : zone.name if endswith(domain, zone.name)] }
  domain_to_zone_candidates_name_length     = { for domain, candidates in local.domain_to_zone_candidates : domain => [for candidate in candidates : length(candidate)] }
  domain_to_zone_index_of_longest_candidate = { for domain, candidate_lengths in local.domain_to_zone_candidates_name_length : domain => index(candidate_lengths, max(candidate_lengths...)) }
  domain_to_zone                            = { for domain, candidates in local.domain_to_zone_candidates : domain => [for zone in data.aws_route53_zone.zones : zone.zone_id if zone.name == candidates[local.domain_to_zone_index_of_longest_candidate[domain]]][0] }

  // See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html#choose-origin-shield-region
  origin_shield_region_mappings = {
    "us-east-2"      = "us-east-2"
    "us-east-1"      = "us-east-1"
    "us-west-2"      = "us-west-2"
    "ap-south-1"     = "ap-south-1"
    "ap-northeast-2" = "ap-northeast-2"
    "ap-southeast-1" = "ap-southeast-1"
    "ap-northeast-1" = "ap-northeast-1"
    "ap-southeast-2" = "ap-southeast-2"
    "eu-central-1"   = "eu-central-1"
    "eu-west-1"      = "eu-west-1"
    "eu-west-2"      = "eu-west-2"
    "sa-east-1"      = "sa-east-1"
    "us-west-1"      = "us-west-2"
    "af-south-1"     = "eu-west-1"
    "ap-east-1"      = "ap-southeast-1"
    "ca-central-1"   = "us-east-1"
    "eu-south-1"     = "eu-central-1"
    "eu-west-3"      = "eu-west-2"
    "eu-north-1"     = "eu-west-2"
    "me-south-1"     = "ap-south-1"
  }

  response_function_enabled = var.cors_enabled

  default_allowed_methods      = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
  default_cached_methods       = ["GET", "HEAD"]
  default_min_ttl              = 0 // These TTL settings ensure that the origin cache headers are respected: https://github.com/hashicorp/terraform-provider-aws/issues/19382
  default_default_ttl          = 86400
  default_max_ttl              = 31536000
  default_cookies_in_cache_key = ["*"]
  default_headers_in_cache_key = [
    "Authorization", // We add this by default prevent security issues by people using this for authz/n

    // We match cloudflare: https://developers.cloudflare.com/cache/how-to/cache-keys/
    "Origin",
    "x-http-method-override",
    "x-http-method",
    "x-method-override",
    "x-forwarded-host",
    "x-host",
    "x-original-url",
    "x-rewrite-url",
    "forwarded"
  ]
  default_query_strings_in_cache_key  = ["*"]
  default_cookies_not_forwarded       = []
  default_headers_not_forwarded       = []
  default_query_strings_not_forwarded = []
  default_compression_enabled         = true
  default_viewer_protocol_policy      = "redirect-to-https"

  default_cache_behavor = {
    caching_enabled             = true
    allowed_methods             = local.default_allowed_methods
    cached_methods              = local.default_cached_methods
    min_ttl                     = local.default_min_ttl
    default_ttl                 = local.default_default_ttl
    max_ttl                     = local.default_max_ttl
    cookies_in_cache_key        = local.default_cookies_in_cache_key
    headers_in_cache_key        = local.default_headers_in_cache_key
    query_strings_in_cache_key  = local.default_query_strings_in_cache_key
    cookies_not_forwarded       = local.default_cookies_not_forwarded
    headers_not_forwarded       = local.default_headers_not_forwarded
    query_strings_not_forwarded = local.default_query_strings_not_forwarded
    compression_enabled         = local.default_compression_enabled
    viewer_protocol_policy      = local.default_viewer_protocol_policy
  }

  origin_configs = { for config in [for config in var.origin_configs : {
    origin_id                = lookup(config, "origin_id", null) == null ? substr(sha256("${join("", var.domains)}${var.name}${config.path_prefix}"), 0, 12) : lookup(config, "origin_id")
    path_prefix              = config.path_prefix
    origin_access_control_id = config.origin_access_control_id
    default_cache_behavior   = merge(local.default_cache_behavor, lookup(config, "default_cache_behavior", {}))
    path_match_behavior      = { for path, behavior in lookup(config, "path_match_behavior", {}) : path => merge(local.default_cache_behavor, behavior) }
    origin_domain            = config.origin_domain
    extra_origin_headers     = config.extra_origin_headers
    rewrite_rules            = config.rewrite_rules
    remove_prefix            = config.remove_prefix
  }] : config.origin_id => config }

  origin_configs_by_path_behavior = { for config in flatten([for config in local.origin_configs : [for path, behavior in config.path_match_behavior : merge({ origin_id = config.origin_id, origin_path_prefix : config.path_prefix, path : path, origin_access_control_id = config.origin_access_control_id }, behavior)]]) : substr(sha256("${config.origin_id}-${config.path}"), 0, 12) => config }

  // This ensures that longer prefixes are always first when applied to the CDN cache configs; this is important
  // because we prioritize specificity (otherwise /a might take precedence over /abc)
  prefixes_sorted       = reverse(sort([for config in local.origin_configs : config.path_prefix]))
  origin_configs_sorted = flatten([for prefix in local.prefixes_sorted : [for config in local.origin_configs : config if config.path_prefix == prefix]])

  // Whether to enable the viewer request function (only enable if we are doing some mutation or logic based on the request)
  global_page_rules_enabled       = length(var.redirect_rules) > 0 || var.cors_enabled
  viewer_request_function_configs = { for k, v in local.origin_configs : k => v if local.global_page_rules_enabled || length(v.rewrite_rules) > 0 || v.remove_prefix }
}

data "aws_region" "region" {}

/********************************************************************************************************************
* CDN
*********************************************************************************************************************/

///////////////////////////////////////////////////
/// Step 1: Provision the ACM certificates for the CDN
//  which includes DNS verification
///////////////////////////////////////////////////

data "aws_route53_zones" "zones" {}

data "aws_route53_zone" "zones" {
  for_each = toset(data.aws_route53_zones.zones.ids)
  zone_id  = each.key
}

resource "aws_acm_certificate" "cdn" {
  provider = aws.global

  domain_name               = var.domains[0]
  subject_alternative_names = slice(var.domains, 1, length(var.domains))
  validation_method         = "DNS"

  tags = merge(data.pf_aws_tags.tags.tags, {
    Name        = var.name
    description = "Certificate for the ${var.name} CDN"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cdn.domain_validation_options : dvo.domain_name => {
      name    = dvo.resource_record_name
      record  = dvo.resource_record_value
      type    = dvo.resource_record_type
      zone_id = local.domain_to_zone[dvo.domain_name]
    }
  }
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = each.value.zone_id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "cert" {
  provider = aws.global

  certificate_arn         = aws_acm_certificate.cdn.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  lifecycle {
    create_before_destroy = true
  }
}


///////////////////////////////////////////////////
/// Step 2: Create the building-block resources
///////////////////////////////////////////////////

resource "aws_cloudfront_cache_policy" "root" {
  name        = "default-${var.name}"
  comment     = "Default cache behaviors for CDN ${var.name}"
  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000
  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_origin_request_policy" "root" {
  name    = "default-${var.name}"
  comment = "Default origin request policy for CDN ${var.name}"
  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "allViewer"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}


// The defaults for the origins (not for the overall CDN)
resource "aws_cloudfront_cache_policy" "default_cache_behaviors" {
  for_each    = local.origin_configs
  name        = "default-${each.key}"
  comment     = "Default cache behaviors for origin id ${each.key} for ${var.name}"
  default_ttl = each.value.default_cache_behavior.caching_enabled ? each.value.default_cache_behavior.default_ttl : 0
  max_ttl     = each.value.default_cache_behavior.caching_enabled ? each.value.default_cache_behavior.max_ttl : 0
  min_ttl     = each.value.default_cache_behavior.caching_enabled ? each.value.default_cache_behavior.min_ttl : 0
  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = (!each.value.default_cache_behavior.caching_enabled || length(each.value.default_cache_behavior.cookies_in_cache_key) == 0) ? "none" : (contains(each.value.default_cache_behavior.cookies_in_cache_key, "*") ? "all" : "whitelist")
      dynamic "cookies" {
        for_each = !each.value.default_cache_behavior.caching_enabled || length(each.value.default_cache_behavior.cookies_in_cache_key) == 0 || contains(each.value.default_cache_behavior.cookies_in_cache_key, "*") ? [] : ["items_needed"]
        content {
          items = each.value.default_cache_behavior.cookies_in_cache_key
        }
      }
    }
    headers_config {
      header_behavior = each.value.default_cache_behavior.caching_enabled ? (length(each.value.default_cache_behavior.headers_in_cache_key) == 0 ? "none" : "whitelist") : "none"
      dynamic "headers" {
        for_each = !each.value.default_cache_behavior.caching_enabled || length(each.value.default_cache_behavior.headers_in_cache_key) == 0 ? [] : ["items_needed"]
        content {
          items = each.value.default_cache_behavior.headers_in_cache_key
        }
      }
    }
    query_strings_config {
      query_string_behavior = (!each.value.default_cache_behavior.caching_enabled || length(each.value.default_cache_behavior.query_strings_in_cache_key) == 0) ? "none" : (contains(each.value.default_cache_behavior.query_strings_in_cache_key, "*") ? "all" : "whitelist")
      dynamic "query_strings" {
        for_each = !each.value.default_cache_behavior.caching_enabled || length(each.value.default_cache_behavior.query_strings_in_cache_key) == 0 || contains(each.value.default_cache_behavior.query_strings_in_cache_key, "*") ? [] : ["items_needed"]
        content {
          items = each.value.default_cache_behavior.query_strings_in_cache_key
        }
      }
    }
    enable_accept_encoding_brotli = each.value.default_cache_behavior.caching_enabled
    enable_accept_encoding_gzip   = each.value.default_cache_behavior.caching_enabled
  }
}

// The defaults for the origins (not for the overall CDN)
# Note: If the origin_access_control_id is set, assume that we are targeting an S3 bucket, so set this to very specific values
# to ensure that signatures are calculated correctly. As a result, we override the module inputs.
resource "aws_cloudfront_origin_request_policy" "default_cache_behaviors" {
  for_each = local.origin_configs
  name     = "default-${each.key}"
  comment  = "Default origin request policy for origin id ${each.key} for ${var.name}"

  cookies_config {
    cookie_behavior = each.value.origin_access_control_id == null ? (length(each.value.default_cache_behavior.cookies_not_forwarded) == 0 ? "all" : "allExcept") : "none"
    dynamic "cookies" {
      for_each = each.value.origin_access_control_id != null || length(each.value.default_cache_behavior.cookies_not_forwarded) == 0 ? [] : ["items_needed"]
      content {
        items = each.value.default_cache_behavior.cookies_not_forwarded
      }
    }
  }
  headers_config {
    header_behavior = each.value.origin_access_control_id == null ? (length(each.value.default_cache_behavior.headers_not_forwarded) == 0 ? "allViewer" : "allExcept") : "whitelist"
    dynamic "headers" {
      for_each = each.value.origin_access_control_id == null && length(each.value.default_cache_behavior.headers_not_forwarded) == 0 ? [] : ["items_needed"]
      content {
        items = each.value.origin_access_control_id == null ? each.value.default_cache_behavior.headers_not_forwarded : ["origin", "access-control-request-headers", "access-control-request-method"]
      }
    }
  }
  query_strings_config {
    query_string_behavior = each.value.origin_access_control_id == null ? (length(each.value.default_cache_behavior.query_strings_not_forwarded) == 0 ? "all" : "allExcept") : "none"
    dynamic "query_strings" {
      for_each = each.value.origin_access_control_id != null || length(each.value.default_cache_behavior.query_strings_not_forwarded) == 0 ? [] : ["items_needed"]
      content {
        items = each.value.default_cache_behavior.query_strings_not_forwarded
      }
    }
  }
}

// Path-based cache policies
resource "aws_cloudfront_cache_policy" "path_behaviors" {
  for_each    = local.origin_configs_by_path_behavior
  name        = "path-${each.key}"
  comment     = "Path-based cache behaviors for origin id ${each.value.origin_id} for path ${each.value.path} in CDN ${var.name}"
  default_ttl = each.value.caching_enabled ? each.value.default_ttl : 0
  max_ttl     = each.value.caching_enabled ? each.value.max_ttl : 0
  min_ttl     = each.value.caching_enabled ? each.value.min_ttl : 0
  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = (!each.value.caching_enabled || length(each.value.cookies_in_cache_key) == 0) ? "none" : (contains(each.value.cookies_in_cache_key, "*") ? "all" : "whitelist")
      dynamic "cookies" {
        for_each = !each.value.caching_enabled || length(each.value.cookies_in_cache_key) == 0 || contains(each.value.cookies_in_cache_key, "*") ? [] : ["items_needed"]
        content {
          items = each.value.cookies_in_cache_key
        }
      }
    }
    headers_config {
      header_behavior = each.value.caching_enabled ? (length(each.value.headers_in_cache_key) == 0 ? "none" : "whitelist") : "none"
      dynamic "headers" {
        for_each = !each.value.caching_enabled || length(each.value.headers_in_cache_key) == 0 ? [] : ["items_needed"]
        content {
          items = each.value.headers_in_cache_key
        }
      }
    }
    query_strings_config {
      query_string_behavior = (!each.value.caching_enabled || length(each.value.query_strings_in_cache_key) == 0) ? "none" : (contains(each.value.query_strings_in_cache_key, "*") ? "all" : "whitelist")
      dynamic "query_strings" {
        for_each = !each.value.caching_enabled || length(each.value.query_strings_in_cache_key) == 0 || contains(each.value.query_strings_in_cache_key, "*") ? [] : ["items_needed"]
        content {
          items = each.value.query_strings_in_cache_key
        }
      }
    }
    enable_accept_encoding_brotli = each.value.caching_enabled
    enable_accept_encoding_gzip   = each.value.caching_enabled
  }
}

# Path-based origin request policies
# Note: If the origin_access_control_id is set, assume that we are targeting an S3 bucket, so set this to very specific values
# to ensure that signatures are calculated correctly. As a result, we override the module inputs.
resource "aws_cloudfront_origin_request_policy" "path_behaviors" {

  for_each = local.origin_configs_by_path_behavior
  name     = "path-${each.key}"
  comment  = "Path-based origin request policies for origin id ${each.value.origin_id} for path ${each.value.path} in CDN ${var.name}"

  cookies_config {
    cookie_behavior = each.value.origin_access_control_id == null ? (length(each.value.cookies_not_forwarded) == 0 ? "all" : "allExcept") : "none"
    dynamic "cookies" {
      for_each = each.value.origin_access_control_id != null || length(each.value.cookies_not_forwarded) == 0 ? [] : ["items_needed"]
      content {
        items = each.value.cookies_not_forwarded
      }
    }
  }
  headers_config {
    header_behavior = each.value.origin_access_control_id == null ? (length(each.value.headers_not_forwarded) == 0 ? "allViewer" : "allExcept") : "whitelist"
    dynamic "headers" {
      for_each = each.value.origin_access_control_id == null && length(each.value.headers_not_forwarded) == 0 ? [] : ["items_needed"]
      content {
        items = each.value.origin_access_control_id == null ? each.value.headers_not_forwarded : ["origin", "access-control-request-headers", "access-control-request-method"]
      }
    }
  }
  query_strings_config {
    query_string_behavior = each.value.origin_access_control_id == null ? (length(each.value.query_strings_not_forwarded) == 0 ? "all" : "allExcept") : "none"
    dynamic "query_strings" {
      for_each = each.value.origin_access_control_id != null || length(each.value.query_strings_not_forwarded) == 0 ? [] : ["items_needed"]
      content {
        items = each.value.query_strings_not_forwarded
      }
    }
  }
}

resource "random_id" "error" {
  prefix      = "${var.name}-error-"
  byte_length = 4
}

resource "aws_cloudfront_function" "error" {
  provider = aws.global
  name     = random_id.error.hex
  code     = file("${path.module}/404.js")
  comment  = "Returns 404 if none of the upstreams can handle the inbound request for ${var.name} CDN"
  runtime  = "cloudfront-js-2.0"
  publish  = true
}

// The page rules function
resource "random_id" "request" {
  for_each = local.viewer_request_function_configs

  prefix      = "${var.name}-request-"
  byte_length = 4

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudfront_function" "request" {
  provider = aws.global
  for_each = local.viewer_request_function_configs

  name = random_id.request[each.key].hex
  code = templatefile("${path.module}/request.js", {
    REDIRECT_RULES = jsonencode(var.redirect_rules)
    REWRITE_RULES = jsonencode([for rule in each.value.rewrite_rules : {
      rewrite = rule.rewrite
      match   = replace("^${each.value.path_prefix}${trimsuffix(trimprefix(rule.match, "^"), "$")}$", "/\\/\\//", "/")
    }])
    CORS_RULES = jsonencode({
      enabled         = var.cors_enabled
      max_age         = var.cors_max_age_seconds
      allowed_headers = var.cors_allowed_headers
      allowed_methods = var.cors_allowed_methods
      allowed_origins = concat([for domain in var.domains : "https://${domain}"], var.cors_additional_allowed_origins)
    })
    PATH_PREFIX   = each.value.path_prefix
    REMOVE_PREFIX = each.value.remove_prefix
  })
  comment = "Rules for inbound requests for ${var.name} CDN origin ${each.key}"
  runtime = "cloudfront-js-2.0"
  publish = true

  lifecycle {
    create_before_destroy = true
  }
}

// The response function
resource "random_id" "response" {
  count = local.response_function_enabled ? 1 : 0

  prefix      = "${var.name}-response-"
  byte_length = 4
}

resource "aws_cloudfront_function" "response" {
  provider = aws.global
  count    = local.response_function_enabled ? 1 : 0

  name = random_id.response[0].hex
  code = templatefile("${path.module}/response.js", {
    CORS_RULES = jsonencode({
      enabled         = var.cors_enabled
      max_age         = var.cors_max_age_seconds
      allowed_headers = var.cors_allowed_headers
      allowed_methods = var.cors_allowed_methods
      allowed_origins = concat([for domain in var.domains : "https://${domain}"], var.cors_additional_allowed_origins)
    })
  })
  comment = "Response mutator for ${var.name} CDN"
  runtime = "cloudfront-js-2.0"
  publish = true
}

resource "random_id" "log_bucket_name" {
  count = var.logging_enabled ? 1 : 0

  byte_length = 4
  prefix      = "${lower(var.name)}-logs-"
}

module "log_bucket" {
  count  = var.logging_enabled ? 1 : 0
  source = "../aws_s3_private_bucket"

  bucket_name = random_id.log_bucket_name[0].hex
  description = "Logs for ${var.name} CDN"

  acl_aws_logs_delivery_enabled = true
  expire_after_days             = var.logging_expire_after_days
}

///////////////////////////////////////////////////
/// Step 3: Create the distribution
///////////////////////////////////////////////////

resource "aws_cloudfront_distribution" "cdn" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = var.name
  price_class     = var.price_class
  aliases         = var.domains

  dynamic "origin" {
    for_each = local.origin_configs
    content {

      origin_id                = origin.key
      domain_name              = origin.value.origin_domain
      origin_access_control_id = origin.value.origin_access_control_id

      // defines how to connect to the origin
      dynamic "custom_origin_config" {
        for_each = origin.value.origin_access_control_id == null ? ["enabled"] : []
        content {
          origin_protocol_policy   = "https-only"
          http_port                = 80
          https_port               = 443
          origin_ssl_protocols     = ["TLSv1.2"]
          origin_keepalive_timeout = 60
          origin_read_timeout      = 60
        }
      }

      // extra headers to add IN ADDITION to the headers on the original request
      dynamic "custom_header" {
        for_each = origin.value.extra_origin_headers
        content {
          name  = custom_header.key
          value = custom_header.value
        }
      }

      dynamic "origin_shield" {
        for_each = var.origin_shield_enabled ? ["enabled"] : []
        content {
          enabled              = true
          origin_shield_region = local.origin_shield_region_mappings[data.aws_region.region.name]
        }
      }
    }
  }

  // This should never be hit
  default_cache_behavior {
    target_origin_id         = local.origin_configs[keys(local.origin_configs)[0]].origin_id
    cache_policy_id          = aws_cloudfront_cache_policy.root.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.root.id
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    viewer_protocol_policy   = "redirect-to-https"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.error.arn
    }
  }

  // This MUST come first as it is more specific
  dynamic "ordered_cache_behavior" {
    for_each = local.origin_configs_by_path_behavior
    content {
      path_pattern             = replace("${ordered_cache_behavior.value.origin_path_prefix}${ordered_cache_behavior.value.path}", "////", "/")
      target_origin_id         = ordered_cache_behavior.value.origin_id
      cache_policy_id          = aws_cloudfront_cache_policy.path_behaviors[ordered_cache_behavior.key].id
      origin_request_policy_id = aws_cloudfront_origin_request_policy.default_cache_behaviors[ordered_cache_behavior.value.origin_id].id
      allowed_methods          = ordered_cache_behavior.value.allowed_methods
      cached_methods           = ordered_cache_behavior.value.cached_methods
      compress                 = ordered_cache_behavior.value.compression_enabled
      viewer_protocol_policy   = ordered_cache_behavior.value.viewer_protocol_policy
      dynamic "function_association" {
        for_each = contains(keys(local.viewer_request_function_configs), ordered_cache_behavior.value.origin_id) ? ["enabled"] : []
        content {
          event_type   = "viewer-request"
          function_arn = aws_cloudfront_function.request[ordered_cache_behavior.value.origin_id].arn
        }
      }
      dynamic "function_association" {
        for_each = local.response_function_enabled ? ["enabled"] : []
        content {
          event_type   = "viewer-response"
          function_arn = aws_cloudfront_function.response[0].arn
        }
      }
    }
  }

  // This MUST come second as these are the defaults for each ingress path
  dynamic "ordered_cache_behavior" {
    for_each = local.origin_configs_sorted
    content {
      path_pattern             = "${ordered_cache_behavior.value.path_prefix}*"
      target_origin_id         = ordered_cache_behavior.value.origin_id
      cache_policy_id          = aws_cloudfront_cache_policy.default_cache_behaviors[ordered_cache_behavior.value.origin_id].id
      origin_request_policy_id = aws_cloudfront_origin_request_policy.default_cache_behaviors[ordered_cache_behavior.value.origin_id].id
      allowed_methods          = ordered_cache_behavior.value.default_cache_behavior.allowed_methods
      cached_methods           = ordered_cache_behavior.value.default_cache_behavior.cached_methods
      compress                 = ordered_cache_behavior.value.default_cache_behavior.compression_enabled
      viewer_protocol_policy   = ordered_cache_behavior.value.default_cache_behavior.viewer_protocol_policy
      dynamic "function_association" {
        for_each = contains(keys(local.viewer_request_function_configs), ordered_cache_behavior.value.origin_id) ? ["enabled"] : []
        content {
          event_type   = "viewer-request"
          function_arn = aws_cloudfront_function.request[ordered_cache_behavior.value.origin_id].arn
        }
      }
      dynamic "function_association" {
        for_each = local.response_function_enabled ? ["enabled"] : []
        content {
          event_type   = "viewer-response"
          function_arn = aws_cloudfront_function.response[0].arn
        }
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_list
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cdn.arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

  dynamic "logging_config" {
    for_each = var.logging_enabled ? ["enabled"] : []
    content {
      bucket          = "${module.log_bucket[0].bucket_name}.s3.amazonaws.com"
      include_cookies = var.logging_cookies_enabled
    }
  }

  # We set this to false, because otherwise there is a significant delay in setting
  # up DNS which can lead to unnecessary downtime when enabling the CDN as a part of
  # an automated deployment
  wait_for_deployment = false

  tags = merge(data.pf_aws_tags.tags.tags, {
    Name        = var.name
    description = var.description == null ? var.name : var.description
  })

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_acm_certificate_validation.cert,
    module.log_bucket
  ]
}

///////////////////////////////////////////////////
/// Step 4: Add a DNS record that points to the distribution
///////////////////////////////////////////////////

resource "aws_route53_record" "cdn" {
  for_each = toset(var.domains)

  allow_overwrite = true
  name            = each.key
  type            = "A"
  zone_id         = local.domain_to_zone[each.key]
  alias {
    evaluate_target_health = false
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
  }
}