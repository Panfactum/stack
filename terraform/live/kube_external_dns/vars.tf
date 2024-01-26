variable "external_dns_version" {
  description = "The version of external-dns to deploy"
  type        = string
  default     = "0.13.5"
}

variable "external_dns_helm_version" {
  description = "The version of the external-dns helm chart to deploy"
  type        = string
  default     = "6.22.0"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "dns_zones" {
  description = "A mapping of public DNS domains to their configuration; external-dns uses this to set domain records"
  type = map(object({
    record_manager_role_arn = string
    zone_id                 = string
  }))
  default = {}
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
