variable "iam_policy_json" {
  description = "An IAM policy document in rendered JSON string form."
  type        = string
  default     = null
}

variable "iam_policy_arns" {
  description = "ARNs of IAM policies to attach to the generated user."
  type        = list(string)
  default     = []
}

variable "credential_lifetime_hours" {
  description = "The number of hours that provisioned credentials last before they are rotated."
  type        = number
  default     = 16
}

variable "namespace" {
  description = "The namespace that the Kubernetes Secret containing the user credentials will be provisioned within."
  type        = string
}

