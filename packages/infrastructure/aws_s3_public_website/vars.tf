variable "bucket_name" {
  description = "The name of the s3 bucket."
  type        = string
}

variable "versioning_enabled" {
  description = "Whether object versioning is enabled."
  type        = bool
  default     = false
}

variable "expire_old_versions" {
  description = "Whether old object versions should be expired."
  type        = bool
  default     = true
}

variable "expire_after_days" {
  description = "Whether objects older than indicated days should be deleted. (0 to disable)"
  type        = number
  default     = 0
}

variable "timed_transitions_enabled" {
  description = "Whether objects should be transitioned to lower storage tiers after a certain amount of time."
  type        = bool
  default     = false
}

variable "intelligent_transitions_enabled" {
  description = "Whether objects should be subject to intelligent access tiering."
  type        = bool
  default     = true
}

variable "description" {
  description = "A statement of purpose for the S3 bucket."
  type        = string
}

variable "force_destroy" {
  description = "Whether the bucket can be deleted if objects still exist in it."
  type        = bool
  default     = false
}

variable "domain" {
  description = "The domain name to serve content from"
  type        = string
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

variable "logging_enabled" {
  description = "Whether request logging should be enabled for the CloudFront distribution"
  type        = bool
  default     = false
}

variable "logging_cookies_enabled" {
  description = "Whether cookies should be included in the CloudFront request logs"
  type        = bool
  default     = false
}

variable "logging_expire_after_days" {
  description = "The number of days after which CloudFront logs will be deleted. (0 to disable)"
  type        = number
  default     = 0
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

variable "default_cache_behavior" {
  description = "The default configuration for requests that hit the CloudFront distribution."
  type = object({
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
    query_strings_in_cache_key = optional(list(string), ["*"])         # Which query strings will be included in the cache key (Providing "*" means ALL query strings)
    compression_enabled        = optional(bool, true)                  # Whether the CDN performs compression on your assets
    viewer_protocol_policy     = optional(string, "redirect-to-https") # What should happen based on the client protocol (HTTP vs HTTPS). One of: allow-all, https-only, redirect-to-https
  })
  default = {}
}

variable "path_match_behaviors" {
  description = "Similar to default_cache_behavior but allows you to specify specific rules for certain path patterns. The keys for this map are the path patterns (e.g., '*.jpg')."
  type = map(object({
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
    query_strings_in_cache_key = optional(list(string), ["*"])
    compression_enabled        = optional(bool, true)
    viewer_protocol_policy     = optional(string, "redirect-to-https")
  }))
  default = {}
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
  description = "Specifies which origins are allowed besides the domain name specified"
  type        = list(string)
  default     = []
}

variable "cors_expose_headers" {
  description = "Specifies expose header in the response."
  type        = list(string)
  default     = []
}

variable "default_file" {
  description = "A default file name to use when no file is specified (/some/file/ => /some/file/index.html). If this is '', no default file extension will be applied."
  type        = string
  default     = "index.html"
}

variable "default_file_strict" {
  description = "Iff true, then all requests with paths that do not contain a `.` will have the `default_file` appended."
  type        = bool
  default     = true
}

variable "rewrite_rules" {
  description = "Rewrite rules to add for the path resolution"
  type = list(object({
    match   = string
    rewrite = string
  }))
  default = []
}