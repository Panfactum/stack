variable "environment_access_map" {
  type = map(object({
    account_id       = string
    superuser_groups = list(string)
    admin_groups     = list(string)
    reader_groups    = list(string)
  }))
}

variable "protected_s3_arns" {
  description = "A list of protected s3 buckets for the environment."
  type        = list(string)
  default     = []
}

variable "protected_kms_arns" {
  description = "A list of protected kms arns for the environment."
  type        = list(string)
  default     = []
}

variable "protected_dynamodb_arns" {
  description = "A list of protected dynamodb arns for the environment."
  type        = list(string)
  default     = []
}
