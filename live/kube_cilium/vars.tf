variable "cilium_helm_version" {
  description = "The version of the metrics-server helm chart to deploy"
  type        = string
  default     = "1.14.0"
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

variable "public_outbound_ips" {
  description = "A list of the public ips for outbound cluster traffic"
  type        = list(string)
}
