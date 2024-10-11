variable "name" {
  description = "The name of the CDN that will get created"
  type        = string
}

variable "cdn_origin_configs" {
  description = "A list of configuration settings for communicating with the upstream ingress resources"
  type = list(object({
    origin_id            = string       # A globally unique identifier for this origin
    origin_domain        = string       # The domain name of the ingress origin
    domains              = list(string) # The domain names to use for the CDN servers
    path_prefix          = string       # Only traffic with this HTTP path prefix will be routed to the indicated origin
    extra_origin_headers = map(string)  # Additional headers sent from the CDN to the origin

    # The default behavior of the CDN before routing requests to this ingress
    default_cache_behavior = object({
      allowed_methods             = list(string) # What HTTP methods are allowed
      cached_methods              = list(string) # What HTTP methods will be cached
      min_ttl                     = number       # Minimum cache time
      default_ttl                 = number       # Default cache time
      max_ttl                     = number       # Maximum cache time
      cookies_in_cache_key        = list(string) # Which cookies will be included in the cache key
      headers_in_cache_key        = list(string) # Which headers will be included in the cache key
      query_strings_in_cache_key  = list(string) # Which query strings will be included in the cache key
      cookies_not_forwarded       = list(string) # Which cookies will NOT be forwarded to the ingress from the CDN
      headers_not_forwarded       = list(string) # Which headers will NOT be forwarded to the ingress from CDN
      query_strings_not_forwarded = list(string) # Which query strings will NOT be forwarded to the ingress from the CDN
      compression_enabled         = bool         # Whether the CDN performs compression on your assets
      viewer_protocol_policy      = string       # What should happen based on the client protocol (HTTP vs HTTPS)
    })

    # Similar to default_cache_behavior but allows you to specific specific rules for certain path patterns
    # The keys for this map are the path patterns (e.g., "*.jpg")
    # Path patterns will automatically be prefixed with the ingress' path_prefix value, so it can be omitted
    path_match_behavior = optional(map(object({
      allowed_methods             = list(string)
      cached_methods              = list(string)
      min_ttl                     = number
      default_ttl                 = number
      max_ttl                     = number
      cookies_in_cache_key        = list(string)
      headers_in_cache_key        = list(string)
      query_strings_in_cache_key  = list(string)
      cookies_not_forwarded       = list(string)
      headers_not_forwarded       = list(string)
      query_strings_not_forwarded = list(string)
      compression_enabled         = bool
      viewer_protocol_policy      = string
    })))
  }))
}


variable "price_class" {
  description = "The price class for the CDN"
  type        = string
  default     = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.price_class)
    error_message = "cdn_price_class must be one of: PriceClass_All, PriceClass_200, PriceClass_100"
  }
}


variable "geo_restriction_type" {
  description = "What type of geographic restrictions to you want to apply to CDN clients"
  type        = string
  default     = "none"
  validation {
    condition     = contains(["whitelist", "blacklist", "none"], var.geo_restriction_type)
    error_message = "geo_restriction_type must be one of: whitelist, blacklist, none"
  }
}

variable "geo_restriction_list" {
  description = "A list of ISO 3166 country codes for the geographic restriction list (works for both whitelist and blacklist)"
  type        = list(string)
  default     = []
}

variable "origin_shield_enabled" {
  description = "Whether origin shield should be enabled for the CloudFront distribution"
  type        = bool
  default     = false
}
