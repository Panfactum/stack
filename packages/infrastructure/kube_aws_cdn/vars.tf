variable "name" {
  description = "The name of the CDN that will get created"
  type        = string
}

variable "description" {
  description = "A description for this CDN"
  type        = string
  default     = null
}

variable "origin_configs" {
  description = "A list of configuration settings for communicating with the upstream ingress resources. Do NOT set this manually. Use the outputs from kube_ingress."
  type = list(object({
    origin_id            = optional(string)          # A globally unique identifier for this origin (will be automatically computed if not provided)
    origin_domain        = string                    # The domain name of the ingress origin
    domains              = list(string)              # The domains for this ingress
    path_prefix          = optional(string, "/")     # Only traffic with this HTTP path prefix will be routed to the indicated origin
    extra_origin_headers = optional(map(string), {}) # Headers sent from the CDN to the origin

    # The default behavior of the CDN before routing requests to this ingress
    default_cache_behavior = optional(object({
      caching_enabled      = optional(bool, true)                                                                 # Whether the CDN should cache responses from the origin (overrides all other caching settings)
      allowed_methods      = optional(list(string), ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]) # What HTTP methods are allowed
      cached_methods       = optional(list(string), ["GET", "HEAD"])                                              # What HTTP methods will be cached
      min_ttl              = optional(number, 0)                                                                  # Minimum cache time
      default_ttl          = optional(number, 86400)                                                              # Default cache time
      max_ttl              = optional(number, 31536000)                                                           # Maximum cache time
      cookies_in_cache_key = optional(list(string), ["*"])                                                        # Which cookies will be included in the cache key (Providing "*" means ALL cookies)
      headers_in_cache_key = optional(list(string), [                                                             # Which headers will be included in the cache key
        "Authorization",
        "Origin",
        "x-http-method-override",
        "x-http-method",
        "x-method-override",
        "x-forwarded-host",
        "x-host",
        "x-original-url",
        "x-rewrite-url",
        "forwarded"
      ])
      query_strings_in_cache_key  = optional(list(string), ["*"])         # Which query strings will be included in the cache key (Providing "*" means ALL query strings)
      cookies_not_forwarded       = optional(list(string), [])            # Which cookies will NOT be forwarded to the ingress from the CDN
      headers_not_forwarded       = optional(list(string), [])            # Which headers will NOT be forwarded to the ingress from CDN
      query_strings_not_forwarded = optional(list(string), [])            # Which query strings will NOT be forwarded to the ingress from the CDN
      compression_enabled         = optional(bool, true)                  # Whether the CDN performs compression on your assets
      viewer_protocol_policy      = optional(string, "redirect-to-https") # What should happen based on the client protocol (HTTP vs HTTPS)
    }))

    # Similar to default_cache_behavior but allows you to specific specific rules for certain path patterns
    # The keys for this map are the path patterns (e.g., "*.jpg")
    # Path patterns will automatically be prefixed with the path_prefix value, so it can be omitted
    path_match_behavior = optional(map(object({
      caching_enabled      = optional(bool, true) # Whether the CDN should cache responses from the origin (overrides all other caching settings)
      allowed_methods      = optional(list(string), ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"])
      cached_methods       = optional(list(string), ["GET", "HEAD"])
      min_ttl              = optional(number, 0)
      default_ttl          = optional(number, 86400)
      max_ttl              = optional(number, 31536000)
      cookies_in_cache_key = optional(list(string), ["*"])
      headers_in_cache_key = optional(list(string), [
        "Authorization",
        "Origin",
        "x-http-method-override",
        "x-http-method",
        "x-method-override",
        "x-forwarded-host",
        "x-host",
        "x-original-url",
        "x-rewrite-url",
        "forwarded"
      ])
      query_strings_in_cache_key  = optional(list(string), ["*"])
      cookies_not_forwarded       = optional(list(string), [])
      headers_not_forwarded       = optional(list(string), [])
      query_strings_not_forwarded = optional(list(string), [])
      compression_enabled         = optional(bool, true)
      viewer_protocol_policy      = optional(string, "redirect-to-https")
    })), {})
  }))
}

variable "redirect_rules" {
  description = "A list of redirect rules that the ingress will match against before sending requests to the upstreams"
  type = list(object({
    source    = string                # A regex string for matching the entire request url (^https://domain.com(/.*)?$)
    target    = string                # The redirect target (can use numbered capture groups from the source - https://domain2.com/$1)
    permanent = optional(bool, false) # If true will issue a 301 redirect; otherwise, will use 302
  }))
  default = []
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


variable "logging_enabled" {
  description = "Whether request logging should be enabled for the CloudFront distribution"
  type        = bool
  default     = false
}

variable "logging_cookies_enabled" {
  description = "Whether cookies should be included in the request logs"
  type        = bool
  default     = false
}

variable "logging_expire_after_days" {
  description = "The number of days after which logs will be deleted. (0 to disable)"
  type        = number
  default     = 0
}

variable "cors_enabled" {
  description = "True if the CloudFront distribution should handle adding CORS headers instead of the origin."
  type        = bool
  default     = false
}

variable "cors_max_age_seconds" {
  description = "Time in seconds that the browser can cache the response for a preflight CORS request."
  type        = number
  default     = 3600
}

variable "cors_allowed_headers" {
  description = "Specifies which headers are allowed for CORS requests."
  type        = list(string)
  default     = ["Content-Length"]
}

variable "cors_allowed_methods" {
  description = "Specifies which methods are allowed. Can be GET, PUT, POST, DELETE or HEAD."
  type        = list(string)
  default     = ["GET", "HEAD"]
}

variable "cors_additional_allowed_origins" {
  description = "Specifies which origins are allowed besides the domain name specified. Use '*' to allow any origin."
  type        = list(string)
  default     = []
}
