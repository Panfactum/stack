variable "description" {
  description = "The description of the KMS key."
  type        = string
}

variable "name" {
  description = "The name of the KMS key."
  type        = string
}

variable "superuser_iam_arns" {
  description = "List of IAM arns for key superusers."
  type        = list(string)
  default     = []
}

variable "admin_iam_arns" {
  description = "List of IAM arns for key admins."
  type        = list(string)
  default     = []
}

variable "reader_iam_arns" {
  description = "List of IAM arns for users who can use the key for encryption and decryption."
  type        = list(string)
  default     = []
}

variable "restricted_reader_iam_arns" {
  description = "List of IAM arns for users who can only view the key."
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