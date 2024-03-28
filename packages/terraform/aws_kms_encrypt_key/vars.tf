variable "description" {
  description = "The description of the KMS key."
  type        = string
}

variable "name" {
  description = "The name of the KMS key."
  type        = string
}

variable "admin_iam_arns" {
  description = "List of IAM arns for key admins."
  type        = list(string)
  default     = []
}

variable "user_iam_arns" {
  description = "List of IAM arns for key users."
  type        = list(string)
  default     = []
}

variable "replication_enabled" {
  description = "Whether to replicate the key to another region"
  type        = bool
  default     = true
}

variable "log_delivery_enabled" {
  description = "Whether to allow the delivery.logs.amazonaws.com service to use the key"
  type        = bool
  default     = false
}