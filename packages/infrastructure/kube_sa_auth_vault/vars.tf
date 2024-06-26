variable "service_account" {
  description = "The name of the service account that should be able to assume the AWS permissions."
  type        = string
}

variable "service_account_namespace" {
  description = "The namespace of the service account."
  type        = string
}

variable "vault_policy_hcl" {
  description = "The HCL of the policy document to assign to this Vault role."
  type        = string
}

variable "audience" {
  description = "The audience claim in the ServiceAccount JWT"
  type        = string
  default     = null
}

variable "token_ttl_seconds" {
  description = "The maximum token lifetime in seconds"
  type        = number
  default     = 60 * 60 * 8
}
