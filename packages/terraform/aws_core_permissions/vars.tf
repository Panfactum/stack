variable "protected_s3_arns" {
  description = "A list of protected s3 buckets for the environment."
  type        = list(string)
}

variable "protected_kms_arns" {
  description = "A list of protected kms arns for the environment."
  type        = list(string)
}

variable "protected_dynamodb_arns" {
  description = "A list of protected dynamodb arns for the environment."
  type        = list(string)
}