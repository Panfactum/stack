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

variable "audit_log_enabled" {
  description = "Whether the bucket's audit log should be stored."
  type        = bool
  default     = false
}

variable "access_policy" {
  description = "AWS access policy for the bucket."
  type        = string
  default     = ""
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
