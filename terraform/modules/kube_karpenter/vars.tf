variable "karpenter_helm_version" {
  description = "The version of the karpenter helm chart to deploy"
  type        = string
  default     = "v0.31.1"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "eks_node_role_arn" {
  description = "The arn of the role the EKS cluster roles are assigned"
  type        = string
}

variable "eks_node_instance_profile" {
  description = "The name of the instance profile to use for the nodes"
  type        = string
}

variable "node_subnets" {
  description = "List of subnet names to deploy karpenter Nodes into."
  type        = set(string)
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authneticate with AWS API"
  type        = list(string)
}
