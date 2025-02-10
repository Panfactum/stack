
variable "aws_ebs_csi_driver_helm_version" {
  description = "The version of the aws-ebs-csi-driver helm chart to deploy"
  type        = string
  default     = "2.37.0"
}

variable "aws_iam_ip_allow_list" {
  description = "A list of IPs that can use the service account token to authenticate with AWS API"
  type        = list(string)
  default     = []
}

variable "vpa_enabled" {
  description = "Whether the VPA resources should be enabled"
  type        = bool
  default     = false
}

variable "pull_through_cache_enabled" {
  description = "Whether to use the ECR pull through cache for the deployed images"
  type        = bool
  default     = true
}

variable "monitoring_enabled" {
  description = "Whether to add active monitoring to the deployed systems"
  type        = bool
  default     = false
}

variable "sla_target" {
  description = "The Panfactum SLA level for the module deployment. 1 = lowest uptime (99.9%), lowest cost -- 3 = highest uptime (99.999%), highest Cost"
  type        = number
  default     = 3

  validation {
    condition     = var.sla_target <= 3 && var.sla_target >= 1
    error_message = "sla_target must be one of: 1, 2, 3"
  }
}

variable "panfactum_scheduler_enabled" {
  description = "Whether to use the Panfactum pod scheduler with enhanced bin-packing"
  type        = bool
  default     = false
}

variable "extra_storage_classes" {
  description = "Extra EBS-backed storage classes to add to the cluster. Keys are the name of the storage class and values are their configuration."
  type = map(object({
    type             = optional(string, "gp3")
    reclaim_policy   = optional(string, "Delete")
    iops_per_gb      = optional(number, null)
    iops             = optional(number, null)
    throughput       = optional(number, 125)
    block_express    = optional(bool, false)
    block_size       = optional(number, null)
    inode_size       = optional(number, null)
    bytes_per_inode  = optional(number, null)
    number_of_inodes = optional(number, null)
    big_alloc        = optional(bool, false)
    cluster_size     = optional(number, null)
  }))

  validation {
    condition     = alltrue([for name, config in var.extra_storage_classes : contains(["io2", "gp3"], config.type)])
    error_message = "type must be one of: io2, gp3"
  }

  validation {
    condition     = alltrue([for name, config in var.extra_storage_classes : !(config.iops_per_gb != null && config.iops != null)])
    error_message = "Only iops OR iops_per_gb may be specified"
  }

  validation {
    condition     = alltrue([for name, config in var.extra_storage_classes : contains(["Retain", "Delete"], config.reclaim_policy)])
    error_message = "reclaim_policy must be one of: Retain, Delete"
  }
}

variable "node_image_cached_enabled" {
  description = "Whether to add the container images to the node image cache for faster startup times"
  type        = bool
  default     = true
}

variable "wait" {
  description = "Wait for resources to be in a ready state before proceeding. Disabling this flag will allow upgrades to proceed faster but will disable automatic rollbacks. As a result, manual intervention may be required for deployment failures."
  type        = bool
  default     = true
}
