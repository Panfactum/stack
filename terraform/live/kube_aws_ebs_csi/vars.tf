
variable "aws_ebs_csi_driver_helm_version" {
  description = "The version of the aws-ebs-csi-driver helm chart to deploy"
  type        = string
  default     = "2.24.0"
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "ip_allow_list" {
  description = "A list of IPs that can use the service account token to authneticate with AWS API"
  type        = list(string)
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}
