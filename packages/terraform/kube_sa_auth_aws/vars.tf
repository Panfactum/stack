variable "service_account" {
  description = "The name of the service account that should be able to assume the AWS permissions."
  type        = string
}

variable "service_account_namespace" {
  description = "The namespace of the service account."
  type        = string
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster that contains the service account."
  type        = string
}

variable "iam_policy_json" {
  description = "An IAM policy document in rendered JSON string form."
  type        = string
}

variable "annotate_service_account" {
  description = "Whether or not to annotate the service account"
  type        = bool
  default     = true
}
variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authneticate with AWS API"
  type        = list(string)
  default     = []
}
