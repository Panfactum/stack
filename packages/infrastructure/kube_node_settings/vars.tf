variable "cluster_endpoint" {
  description = "The address of the API server"
  type        = string
  default     = ""
}

variable "cluster_ca_data" {
  description = "B64 encoded CA data for the cluster API server"
  type        = string
  default     = ""
}

variable "cluster_name" {
  description = "The name of the EKS cluster"
  type        = string
  default     = ""
}

variable "max_pods" {
  description = "The maximum number of pods to run on this node type"
  type        = number
  default     = 50
}

variable "is_spot" {
  description = "Whether these settings are for a spot node"
  type        = bool
  default     = false
}

variable "cluster_dns_service_ip" {
  description = "The IP address of the cluster's DNS service."
  type        = string
}
