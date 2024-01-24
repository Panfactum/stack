variable "vault_helm_version" {
  description = "The version of the vault helm chart to deploy"
  type        = string
  default     = "0.25.0"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "vault_storage_size_gb" {
  description = "The number of gb to allocate to vault storage."
  type        = number
}

variable "environment_domain" {
  description = "The domain on which to bind service records."
  type        = string
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "ingress_enabled" {
  description = "Whether or not to enable the ingress for routing traffic to vault"
  type        = bool
}

variable "public_outbound_ips" {
  description = "A list of the public ips for outbound cluster traffic"
  type        = list(string)
}