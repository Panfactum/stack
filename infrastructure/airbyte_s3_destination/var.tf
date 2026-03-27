variable "bucket_name" {
  description = "The name of the S3 bucket to create for the Airbyte destination"
  type        = string
  default     = null # Will generate a random name if not specified
}

variable "bucket_prefix" {
  description = "The prefix to use for the randomly generated bucket name"
  type        = string
  default     = "airbyte-dest-"
}

variable "versioning_enabled" {
  description = "Whether to enable versioning for the bucket"
  type        = bool
  default     = true
}

variable "pf_module_source" {
  description = "The source of the Panfactum modules"
  type        = string
}

variable "pf_module_ref" {
  description = "The reference of the Panfactum modules"
  type        = string
}