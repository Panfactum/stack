variable "kube_superuser_role_arns" {
  description = "AWS IAM role ARNs that have 'cluster-admin' access to the cluster."
  type        = list(string)
  default     = []
}

variable "kube_admin_role_arns" {
  description = "AWS IAM role ARNs that have read and write access to most cluster resources."
  type        = list(string)
  default     = []
}

variable "kube_reader_role_arns" {
  description = "AWS IAM role ARNs that have read-only access to cluster resources."
  type        = list(string)
  default     = []
}

variable "kube_restricted_reader_role_arns" {
  description = "AWS IAM role ARNs that have restricted read-only access to cluster resources."
  type        = list(string)
  default     = []
}

variable "aws_node_role_arn" {
  description = "AWS IAM role that the EKS nodes use (required for node bootstrapping).."
  type        = string
}
