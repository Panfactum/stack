variable "open_cost_helm_version" {
  description = "The image version of the stakater/reloader helm chart"
  type        = string
  default     = "1.38.1"
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = true
}

variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "spot_data_feed_bucket_arn" {
  description = "The arn of the spot data feed bucket"
  type        = string
}

variable "spot_data_feed_bucket" {
  description = "The name of the spot data feed bucket"
  type        = string
}

variable "spot_data_feed_bucket_region" {
  description = "The region of the spot data feed bucket"
  type        = string
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = true
}
