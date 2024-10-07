variable "website_image_version" {
  description = "The version of the image to use for the deployment"
  type        = string
  default     = "alpha.2"
}

variable "website_domain" {
  description = "The domain name to use for the website"
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "algolia_app_id" {
  description = "The Algolia App ID for the search index"
  type        = string
}

variable "algolia_search_api_key" {
  description = "The Algolia Search API key for the search index"
  type        = string
  sensitive   = true
}

variable "algolia_index_name" {
  description = "The name of the Algolia index to use for the search"
  type        = string
}