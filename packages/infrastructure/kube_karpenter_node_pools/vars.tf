variable "cluster_name" {
  description = "The name of the eks cluster"
  type        = string
}

variable "cluster_endpoint" {
  description = "The URL of the API server of the eks cluster"
  type        = string
}

variable "cluster_ca_data" {
  description = "The B64 encoded CA data of the API server of the eks cluster"
  type        = string
}

variable "node_instance_profile" {
  description = "The instance profile to use for launched nodes"
  type        = string
}

variable "cluster_dns_service_ip" {
  description = "The IP address of the cluster's DNS service."
  type        = string
}

variable "monitoring_enabled" {
  description = "Whether to active monitoring has been added to the cluster"
  type        = bool
  default     = false
}