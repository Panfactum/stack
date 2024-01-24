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