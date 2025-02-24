variable "github_username" {
  description = "The username of the GitHub account used by the CI/CD system"
  type = string
}

variable "github_token" {
  description = "The API token of the GitHub account used by the CI/CD system"
  type = string
  sensitive= true
}

variable "webhook_domain" {
  description = "The domain to use for the EventSource webhook"
  type = string
}

variable "buildkit_bucket_name" {
  description = "The S3 bucket to use as the layer cache"
  type = string
}

variable "buildkit_bucket_region" {
  description = "The region of the S3 bucket to use as the layer cache"
  type = string
}

variable "authentik_token" {
  description = "An API token for setting up Authentik"
  type = string
  sensitive = true
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "scraper_image_version" {
  description = "The version of the image to use for the scraper"
  type        = string
}

variable "algolia_app_id" {
  description = "The Algolia App ID for the search index"
  type        = string
}

variable "algolia_api_key" {
  description = "The Algolia API key for the search index"
  type        = string
  sensitive   = true
}

variable "algolia_search_api_key" {
  description = "The Algolia Search API key for the search index that can be publicly exposed"
  type        = string
}

variable "algolia_index_name" {
  description = "The name of the Algolia index to use for the search"
  type        = string
}

variable "algolia_index_name_2" {
  description = "The name of the Algolia index to use for the new website"
  type        = string
}

variable "mongodb_atlas_public_key" {
  description = "The public key for MongoDB Atlas"
  type        = string
  sensitive   = true
}

variable "mongodb_atlas_private_key" {
  description = "The private key for MongoDB Atlas"
  type        = string
  sensitive   = true
}

variable "site_url" {
  description = "The URL of the site to use for the search index"
  type        = string
}

variable "pf_module_source" {
  description = "The source for Panfactum submodules"
  type = string
}

variable "pf_module_ref" {
  description = "The git ref for Panfactum submodules"
  type = string
}

variable "module_bucket" {
  description = "The S3 bucket that host tf modules"
  type = string
}
