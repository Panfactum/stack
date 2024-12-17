variable "name" {
  description = "The name of the CDN that will get created"
  type        = string
}

variable "description" {
  description = "A description for this CDN"
  type        = string
  default     = null
}

variable "domains" {
  description = "A list of domains to use for the CDN"
  type        = list(string)

  validation {
    condition     = length(var.domains) > 0
    error_message = "At least one domain must be specified"
  }
}

variable "origin_configs" {
  description = "A list of configuration settings for communicating with the upstream origins"
  type = list(object({
    origin_id                = optional(string)          # A globally unique identifier for this origin (will be automatically computed if not provided)
    origin_domain            = string                    # The domain name of the ingress origin
    path_prefix              = optional(string, "/")     # Only traffic with this HTTP path prefix will be routed to the indicated origin
    extra_origin_headers     = optional(map(string), {}) # Headers sent from the CDN to the origin
    origin_access_control_id = optional(string, null)    # The OAC id to use for accessing private origins

    # Rules for mutating the request path before it is forwarded to the upstream service
    remove_prefix = optional(bool, false) # True iff the the path_prefix should be stripped before forwarding on to upstream service
    rewrite_rules = optional(list(object({
      match   = string
      rewrite = string
    })), [])

    # The default behavior of the CDN before routing requests to this origin
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
      viewer_protocol_policy      = optional(string, "redirect-to-https") # What should happen based on the client protocol (HTTP vs HTTPS). One of: allow-all, https-only, redirect-to-https
    }))

    # Similar to default_cache_behavior but allows you to specific specific rules for certain path patterns
    # The keys for this map are the path patterns (e.g., "*.jpg")
    # Path patterns will automatically be prefixed with the path_prefix value, so it can be omitted
    path_match_behavior = optional(map(object({
      caching_enabled      = optional(bool, true)
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

  validation {
    condition     = length(var.origin_configs) > 0
    error_message = "At least one origin_config must be specified"
  }
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

variable "price_class" {
  description = "The price class for the CDN. Must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  type        = string
  default     = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.price_class)
    error_message = "cdn_price_class must be one of: PriceClass_All, PriceClass_200, PriceClass_100"
  }
}

variable "geo_restriction_type" {
  description = "What type of geographic restrictions to you want to apply to CDN clients. Must be one of: none, blacklist, whitelist."
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

variable "custom_error_responses" {
  description = "Mutates error responses returned from the origin before forwarding them to the client"
  type = list(object({
    error_caching_min_ttl = optional(number, 60 * 60) // (seconds) Minimum amount of time you want HTTP error codes to stay in CloudFront caches before CloudFront queries your origin to see whether the object has been updated.
    error_code            = string                    // The HTTP status code that you want match (4xx or 5xx)
    response_code         = optional(string)          // The HTTP status code that you actually want to return to the client
    response_page_path    = optional(string)          // The error page to return
  }))
  default = []

  validation {
    condition     = alltrue([for item in var.custom_error_responses : (startswith(item.error_code, "4") || startswith(item.error_code, "5"))])
    error_message = "error_code must start with a 4 or 5"
  }
  validation {
    condition     = alltrue([for item in var.custom_error_responses : (length(item.error_code) == 3)])
    error_message = "error_code must be a valid status code (3 characters) (e.g., '404')"
  }
}
