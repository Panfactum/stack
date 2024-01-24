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

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "public_outbound_ips" {
  description = "A list of the public ips for outbound cluster traffic"
  type        = list(string)
}
