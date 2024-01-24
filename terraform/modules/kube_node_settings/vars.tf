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
