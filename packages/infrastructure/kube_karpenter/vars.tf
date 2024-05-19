variable "karpenter_helm_version" {
  description = "The version of the karpenter helm chart to deploy"
  type        = string
  default     = "0.35.2"
}

variable "cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "node_role_arn" {
  description = "The arn of the role the EKS cluster roles are assigned"
  type        = string
}

variable "node_security_group_id" {
  description = "The id of the security group for nodes running in the EKS cluster"
  type        = string
}

variable "node_vpc_id" {
  description = "The ID of the VPC to deploy karpenter nodes into."
  type        = string
}

variable "node_subnets" {
  description = "List of subnet names to deploy karpenter nodes into."
  type        = set(string)
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "The log level for the karpenter pods"
  type        = string
  default     = "warn"
  validation {
    condition     = contains(["info", "error", "warn", "debug"], var.log_level)
    error_message = "Invalid log_level provided."
  }
}
