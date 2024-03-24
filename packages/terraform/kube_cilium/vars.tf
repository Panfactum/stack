variable "cilium_helm_version" {
  description = "The version of the metrics-server helm chart to deploy"
  type        = string
  default     = "1.15.2"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "eks_cluster_url" {
  description = "The url of the EKS cluster api server"
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = false
}
