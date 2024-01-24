variable "eks_cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
}

variable "public_outbound_ips" {
  description = "A list of the public ips for outbound cluster traffic"
  type        = list(string)
}

variable "min_replicas" {
  description = "The minimum number of replicas of buildkit to use"
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "The maximum number of replicas of buildkit to use"
  type        = number
  default     = 10
}

variable "local_storage_gb" {
  description = "The number of GB to use for the local image temp storage"
  type        = number
}

variable "cpu_millicores" {
  description = "The number of cpus millicores to request for the buildkit pod"
  type        = number
}

variable "memory_mb" {
  description = "The amount of memory in MB to request for the buildkit pod"
  type        = number
}

